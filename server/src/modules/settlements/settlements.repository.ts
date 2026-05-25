import { pool } from "../../db/pool.js";
import type { MarkPaidInput } from "./settlements.schemas.js";

interface OwedRow {
  user_id: number;
  outstanding_amount: string;
}

interface PaidRow {
  user_id: number;
  paid_amount: string;
}

interface UnsettledAmountRow {
  unsettled_amount: string;
}

export interface SettlementEventRecord {
  settlement_event_id: number;
  group_id: number;
  from_user_id: number;
  from_user_name: string;
  to_user_id: number;
  to_user_name: string;
  amount_paid: string;
  note: string | null;
  reference: string | null;
  paid_at: Date;
  created_at: Date;
}

interface NetBalanceRow {
  user_id: number;
  net_balance: string;
  total_paid: string;
  total_owed: string;
}

export const settlementsRepository = {
  async getOutstandingByUser(groupId: number): Promise<OwedRow[]> {
    const { rows } = await pool.query<OwedRow>(
      `SELECT
         COALESCE(combined.user_id, sr.user_id) AS user_id,
         (COALESCE(combined.split_total, 0) - COALESCE(ep.paid_total, 0) + COALESCE(sr.received_total, 0))::text AS outstanding_amount
        FROM (
           SELECT es.user_id, COALESCE(SUM(es.share_amount), 0) AS split_total
           FROM (
             SELECT
               es.user_id,
               CASE
                WHEN es.original_amount IS NOT NULL AND es.original_amount > 0 THEN es.amount_owed
                 WHEN es.percentage IS NOT NULL THEN e.total_amount * es.percentage / 100
                 WHEN es.share IS NOT NULL THEN e.total_amount * es.share / NULLIF(SUM(es.share) OVER (PARTITION BY es.expense_id), 0)
                 ELSE e.total_amount / NULLIF(COUNT(*) OVER (PARTITION BY es.expense_id), 0)
               END AS share_amount
             FROM expense_splits es
             INNER JOIN expenses e ON e.expense_id = es.expense_id
             WHERE e.group_id = $1 AND es.is_settled = FALSE
           ) es
           GROUP BY es.user_id
        ) combined
       FULL JOIN (
         SELECT ep.user_id, COALESCE(SUM(ep.amount_paid), 0) AS paid_total
         FROM expense_payers ep
         INNER JOIN expenses e ON e.expense_id = ep.expense_id
         WHERE e.group_id = $1
         GROUP BY ep.user_id
       ) ep ON ep.user_id = combined.user_id
       FULL JOIN (
         SELECT to_user_id AS user_id, COALESCE(SUM(amount_paid), 0) AS received_total
         FROM settlement_events
         WHERE group_id = $1
         GROUP BY to_user_id
       ) sr ON sr.user_id = COALESCE(combined.user_id, ep.user_id)
       ORDER BY COALESCE(combined.user_id, ep.user_id, sr.user_id)`,
      [groupId],
    );
    return rows;
  },

  async getPaidByUser(groupId: number): Promise<PaidRow[]> {
    const { rows } = await pool.query<PaidRow>(
      `SELECT from_user_id AS user_id, COALESCE(SUM(amount_paid), 0)::text AS paid_amount
       FROM settlement_events
       WHERE group_id = $1
       GROUP BY from_user_id
       ORDER BY from_user_id`,
      [groupId],
    );
    return rows;
  },

  async getUnsettledAmountForUser(groupId: number, userId: number): Promise<number> {
    const { rows } = await pool.query<UnsettledAmountRow>(
      `SELECT (COALESCE(es.total_owed, 0) - COALESCE(ep.total_paid, 0))::text AS unsettled_amount
       FROM (
         SELECT COALESCE(SUM(es2.amount_owed), 0) AS total_owed
         FROM expense_splits es2
         INNER JOIN expenses e2 ON e2.expense_id = es2.expense_id
         WHERE e2.group_id = $1 AND es2.user_id = $2 AND es2.is_settled = FALSE
       ) es
       CROSS JOIN (
         SELECT COALESCE(SUM(ep.amount_paid), 0) AS total_paid
         FROM expense_payers ep
         INNER JOIN expenses e3 ON e3.expense_id = ep.expense_id
         WHERE e3.group_id = $1 AND ep.user_id = $2
       ) ep`,
      [groupId, userId],
    );
    return Number(rows[0]?.unsettled_amount ?? "0");
  },

  async markPaidAndSettleSplits(
    groupId: number,
    input: MarkPaidInput,
  ): Promise<{ expenseTitles: string[]; remainingBalance: number }> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let remaining = input.amount;
      const unsettled = await client.query<{
        split_id: number;
        expense_id: number;
        amount_owed: string;
        title_description: string;
      }>(
        `SELECT es.split_id, e.expense_id, es.amount_owed::text, e.title_description
         FROM expense_splits es
         INNER JOIN expenses e ON e.expense_id = es.expense_id
         WHERE e.group_id = $1
           AND es.user_id = $2
           AND es.is_settled = FALSE
         ORDER BY e.sale_date ASC, es.split_id ASC`,
        [groupId, input.fromUserId],
      );

      const relatedExpenses = new Map<number, string>();
      for (const split of unsettled.rows) {
        if (remaining <= 0.00001) {
          break;
        }
        relatedExpenses.set(split.expense_id, split.title_description);
        const amount = Number(split.amount_owed);
        if (remaining + 0.00001 >= amount) {
          await client.query(
            `UPDATE expense_splits
             SET is_settled = TRUE,
                 amount_owed = 0,
                 updated_at = CURRENT_TIMESTAMP
             WHERE split_id = $1`,
            [split.split_id],
          );
          remaining -= amount;
          continue;
        }

        const nextAmountOwed = Number((amount - remaining).toFixed(2));
        await client.query(
          `UPDATE expense_splits
           SET amount_owed = $2::numeric(10,2),
               updated_at = CURRENT_TIMESTAMP
           WHERE split_id = $1`,
          [split.split_id, nextAmountOwed],
        );
        remaining = 0;
      }

      const expenseIds = Array.from(relatedExpenses.keys());
      const expenseTitles = Array.from(relatedExpenses.values());
      const autoNote =
        expenseIds.length > 0
          ? `For: ${expenseTitles.join(", ")} [expenses:${expenseIds.join(",")}]`
          : "For: manual settlement";
      const note = input.note?.trim() || autoNote;
      await client.query(
        `INSERT INTO settlement_events
          (
            group_id,
            from_user_id,
            to_user_id,
            amount_paid,
            note,
            reference,
            paid_at,
            payer_user_id,
            payee_user_id,
            amount,
            payment_method,
            status,
            payment_date
          )
         VALUES (
           $1, $2, $3, $4::numeric(10,2), $5, $6, $7::timestamptz,
           $2, $3, $4::numeric(10,2), 'other', 'confirmed', $7::timestamptz
         )`,
        [
          groupId,
          input.fromUserId,
          input.toUserId,
          input.amount,
          note ?? null,
          input.reference ?? null,
          input.paidAt ?? new Date().toISOString(),
        ],
      );
      const { rows: balanceRows } = await client.query<{ remaining: string }>(
        `SELECT COALESCE(SUM(es.amount_owed), 0)::text AS remaining
         FROM expense_splits es
         INNER JOIN expenses e ON e.expense_id = es.expense_id
         WHERE e.group_id = $1 AND es.user_id = $2 AND es.is_settled = FALSE`,
        [groupId, input.fromUserId],
      );

      await client.query("COMMIT");
      return {
        expenseTitles: expenseTitles,
        remainingBalance: Number(balanceRows[0]?.remaining ?? 0),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async listHistory(groupId: number): Promise<SettlementEventRecord[]> {
    const { rows } = await pool.query<SettlementEventRecord>(
      `SELECT
         se.settlement_event_id,
         se.group_id,
         se.from_user_id,
         fu.name AS from_user_name,
         se.to_user_id,
         tu.name AS to_user_name,
         se.amount_paid::text,
         se.note,
         se.reference,
         se.paid_at,
         se.created_at
       FROM settlement_events se
       INNER JOIN users fu ON fu.user_id = se.from_user_id
       INNER JOIN users tu ON tu.user_id = se.to_user_id
       WHERE se.group_id = $1
       ORDER BY se.paid_at DESC, se.settlement_event_id DESC`,
      [groupId],
    );
    return rows;
  },

  async getNetBalances(
    groupId: number,
  ): Promise<{ userId: number; netBalance: number; totalPaid: number; totalOwed: number }[]> {
    const { rows } = await pool.query<NetBalanceRow>(
      `WITH payers AS (
         SELECT user_id, COALESCE(SUM(amount_paid), 0) AS total_paid
         FROM expense_payers
         WHERE expense_id IN (SELECT expense_id FROM expenses WHERE group_id = $1)
         GROUP BY user_id
       UNION ALL
          SELECT payer_user_id AS user_id, total_amount::numeric
          FROM expenses
          WHERE group_id = $1
            AND payer_user_id IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM expense_payers
              WHERE expense_payers.expense_id = expenses.expense_id
            )
       ),
       payers_agg AS (
         SELECT user_id, SUM(total_paid) AS total_paid
         FROM payers
         GROUP BY user_id
       )
       SELECT
         COALESCE(es.user_id, ep.user_id) AS user_id,
         (COALESCE(ep.total_paid, 0) - COALESCE(es.total_share, 0))::text AS net_balance,
         COALESCE(ep.total_paid, 0)::text AS total_paid,
         COALESCE(es.total_share, 0)::text AS total_owed
        FROM (
          SELECT user_id, SUM(share_amount) AS total_share
          FROM (
            SELECT
              es.user_id,
              CASE
                WHEN es.original_amount IS NOT NULL AND es.original_amount > 0 THEN es.amount_owed
                WHEN es.percentage IS NOT NULL THEN e.total_amount * es.percentage / 100
                WHEN es.share IS NOT NULL THEN e.total_amount * es.share / NULLIF(SUM(es.share) OVER (PARTITION BY es.expense_id), 0)
                ELSE e.total_amount / NULLIF(COUNT(*) OVER (PARTITION BY es.expense_id), 0)
              END AS share_amount
            FROM expense_splits es
            INNER JOIN expenses e ON e.expense_id = es.expense_id
            WHERE e.group_id = $1
          ) per_expense
          GROUP BY user_id
        ) es
       FULL JOIN payers_agg ep ON ep.user_id = es.user_id
       ORDER BY COALESCE(es.user_id, ep.user_id)`,
      [groupId],
    );
    return rows.map((row) => ({
      userId: row.user_id,
      netBalance: Number(row.net_balance),
      totalPaid: Number(row.total_paid),
      totalOwed: Number(row.total_owed),
    }));
  },
};
