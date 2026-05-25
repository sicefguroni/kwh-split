import { pool } from "../../db/pool.js";
import type {
  CalculatedMemberDiscount,
  CalculatedReceiptItem,
  CalculatedSplit,
} from "./expenses.calculations.js";
import type { ExpenseWriteInput } from "./expenses.schemas.js";

export interface ExpenseRecord {
  expense_id: number;
  group_id: number;
  title_description: string;
  total_amount: string;
  payer_user_id: number | null;
  sale_date: string;
  tax_amount: string;
  tip_amount: string;
  split_type: string;
  category: string;
  note: string;
  receipt_items_flag: boolean;
  receipt_image_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ExpenseSplitRecord {
  split_id: number;
  expense_id: number;
  user_id: number;
  amount_owed: string;
  original_amount: string | null;
  percentage: string | null;
  share: string | null;
  is_settled: boolean;
}

export interface ReceiptItemRecord {
  item_id: number;
  expense_id: number;
  item_name: string;
  price: string;
}

export interface ExpenseMemberDiscountRecord {
  expense_member_discount_id: number;
  expense_id: number;
  user_id: number;
  discount_type: string;
  rate_percent: string;
}

export interface ExpensePayerRecord {
  id: number;
  expense_id: number;
  user_id: number;
  amount_paid: string;
}

export const expensesRepository = {
  async listGroupMemberIds(groupId: number): Promise<number[]> {
    const { rows } = await pool.query<{ user_id: number }>(
      `SELECT user_id FROM group_members WHERE group_id = $1 AND is_active = TRUE ORDER BY user_id`,
      [groupId],
    );
    return rows.map((row) => row.user_id);
  },

  async insertExpensePayers(client: import("pg").PoolClient, expenseId: number, payers: { userId: number; amountPaid: number }[]): Promise<void> {
    for (const payer of payers) {
      await client.query(
        `INSERT INTO expense_payers (expense_id, user_id, amount_paid)
         VALUES ($1, $2, $3::numeric(10,2))
         ON CONFLICT (expense_id, user_id)
         DO UPDATE SET amount_paid = EXCLUDED.amount_paid`,
        [expenseId, payer.userId, payer.amountPaid],
      );
    }
  },

  async listPayerEntries(expenseId: number): Promise<ExpensePayerRecord[]> {
    const { rows } = await pool.query<ExpensePayerRecord>(
      `SELECT id, expense_id, user_id, amount_paid::text
       FROM expense_payers
       WHERE expense_id = $1
       ORDER BY id ASC`,
      [expenseId],
    );
    return rows;
  },

  async deleteExpensePayers(expenseId: number): Promise<void> {
    await pool.query(`DELETE FROM expense_payers WHERE expense_id = $1`, [expenseId]);
  },

  async createWithDetails(input: {
    expense: ExpenseWriteInput;
    splits: CalculatedSplit[];
    receiptItems: CalculatedReceiptItem[];
    memberDiscounts: CalculatedMemberDiscount[];
  }): Promise<number> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const expenseResult = await client.query<{ expense_id: number }>(
        `INSERT INTO expenses
          (group_id, title_description, total_amount, sale_date, tax_amount, tip_amount, split_type, category, note, receipt_items_flag, payer_user_id)
         VALUES ($1, $2, $3::numeric(10,2), $4::date, $5::numeric(10,2), $6::numeric(10,2), $7, $8, $9, $10, $11)
         RETURNING expense_id`,
        [
          input.expense.groupId,
          input.expense.titleDescription,
          input.expense.totalAmount,
          input.expense.saleDate,
          input.expense.taxAmount,
          input.expense.tipAmount,
          input.expense.splitType,
          input.expense.category ?? "General",
          input.expense.note ?? "",
          input.receiptItems.length > 0,
          input.expense.paidByUserId ?? null,
        ],
      );
      const expenseId = expenseResult.rows[0]?.expense_id;
      if (!expenseId) {
        throw new Error("Failed to create expense");
      }

      for (const split of input.splits) {
        await client.query(
          `INSERT INTO expense_splits (expense_id, user_id, amount_owed, original_amount, percentage, share)
           VALUES ($1, $2, $3::numeric(10,2), $3::numeric(10,2), $4, $5::numeric(10,2))`,
          [expenseId, split.userId, split.amountOwed, split.percentage, split.share],
        );
      }

      for (const item of input.receiptItems) {
        const itemResult = await client.query<{ item_id: number }>(
          `INSERT INTO receipt_items (expense_id, item_name, price)
           VALUES ($1, $2, $3::numeric(10,2))
           RETURNING item_id`,
          [expenseId, item.itemName, item.price],
        );
        const itemId = itemResult.rows[0]?.item_id;
        if (!itemId) {
          throw new Error("Failed to create receipt item");
        }
        for (const userId of item.assignedUserIds) {
          await client.query(
            `INSERT INTO receipt_item_assignments (item_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (item_id, user_id) DO NOTHING`,
            [itemId, userId],
          );
        }
      }
      for (const memberDiscount of input.memberDiscounts) {
        await client.query(
          `INSERT INTO expense_member_discounts (expense_id, user_id, discount_type, rate_percent)
           VALUES ($1, $2, $3, $4::numeric(5,2))
           ON CONFLICT (expense_id, user_id)
           DO UPDATE SET
             discount_type = EXCLUDED.discount_type,
             rate_percent = EXCLUDED.rate_percent`,
          [
            expenseId,
            memberDiscount.userId,
            memberDiscount.type,
            memberDiscount.ratePercent,
          ],
        );
      }

      // Insert expense_payers (service layer always resolves payerUserIds before calling this)
      const payers = input.expense.payerUserIds!;
      await expensesRepository.insertExpensePayers(client, expenseId, payers);

      await client.query("COMMIT");
      return expenseId;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async updateWithDetails(input: {
    expenseId: number;
    expense: ExpenseWriteInput;
    splits: CalculatedSplit[];
    receiptItems: CalculatedReceiptItem[];
    memberDiscounts: CalculatedMemberDiscount[];
  }): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const updateResult = await client.query(
        `UPDATE expenses
         SET group_id = $1,
             title_description = $2,
             total_amount = $3::numeric(10,2),
             sale_date = $4::date,
             tax_amount = $5::numeric(10,2),
             tip_amount = $6::numeric(10,2),
             split_type = $7,
             category = $8,
             note = $9,
             receipt_items_flag = $10,
             payer_user_id = $11,
             updated_at = CURRENT_TIMESTAMP
         WHERE expense_id = $12`,
        [
          input.expense.groupId,
          input.expense.titleDescription,
          input.expense.totalAmount,
          input.expense.saleDate,
          input.expense.taxAmount,
          input.expense.tipAmount,
          input.expense.splitType,
          input.expense.category ?? "General",
          input.expense.note ?? "",
          input.receiptItems.length > 0,
          input.expense.paidByUserId ?? null,
          input.expenseId,
        ],
      );
      if (updateResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return false;
      }

      const { rows: oldSplits } = await client.query<{
        user_id: number;
        amount_owed: string;
        original_amount: string | null;
        is_settled: boolean;
      }>(
        `SELECT user_id, amount_owed::text, original_amount::text, is_settled
         FROM expense_splits WHERE expense_id = $1`,
        [input.expenseId],
      );
      const paidByUser = new Map<number, number>();
      for (const old of oldSplits) {
        const originalAmt = old.original_amount ? Number(old.original_amount) : Number(old.amount_owed);
        const currentOwed = Number(old.amount_owed);
        const paid = originalAmt - currentOwed;
        if (paid > 0) {
          paidByUser.set(old.user_id, paid);
        }
      }

      await client.query(`DELETE FROM expense_splits WHERE expense_id = $1`, [input.expenseId]);
      await client.query(`DELETE FROM receipt_items WHERE expense_id = $1`, [input.expenseId]);
      await client.query(`DELETE FROM expense_member_discounts WHERE expense_id = $1`, [input.expenseId]);
      await client.query(`DELETE FROM expense_payers WHERE expense_id = $1`, [input.expenseId]);

      for (const split of input.splits) {
        const alreadyPaid = paidByUser.get(split.userId) ?? 0;
        const adjustedOwed = Math.max(0, Number((split.amountOwed - alreadyPaid).toFixed(2)));
        const isSettled = adjustedOwed <= 0 && alreadyPaid > 0;
        await client.query(
          `INSERT INTO expense_splits (expense_id, user_id, amount_owed, original_amount, percentage, share, is_settled)
           VALUES ($1, $2, $3::numeric(10,2), $4::numeric(10,2), $5, $6::numeric(10,2), $7)`,
          [input.expenseId, split.userId, adjustedOwed, split.amountOwed, split.percentage, split.share, isSettled],
        );
      }
      for (const item of input.receiptItems) {
        const itemResult = await client.query<{ item_id: number }>(
          `INSERT INTO receipt_items (expense_id, item_name, price)
           VALUES ($1, $2, $3::numeric(10,2))
           RETURNING item_id`,
          [input.expenseId, item.itemName, item.price],
        );
        const itemId = itemResult.rows[0]?.item_id;
        if (!itemId) {
          throw new Error("Failed to create receipt item");
        }
        for (const userId of item.assignedUserIds) {
          await client.query(
            `INSERT INTO receipt_item_assignments (item_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (item_id, user_id) DO NOTHING`,
            [itemId, userId],
          );
        }
      }
      for (const memberDiscount of input.memberDiscounts) {
        await client.query(
          `INSERT INTO expense_member_discounts (expense_id, user_id, discount_type, rate_percent)
           VALUES ($1, $2, $3, $4::numeric(5,2))`,
          [
            input.expenseId,
            memberDiscount.userId,
            memberDiscount.type,
            memberDiscount.ratePercent,
          ],
        );
      }

      // Re-insert expense_payers (service layer always resolves payerUserIds before calling this)
      const payers = input.expense.payerUserIds!;
      await expensesRepository.insertExpensePayers(client, input.expenseId, payers);

      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async deleteById(expenseId: number): Promise<boolean> {
    const result = await pool.query(`DELETE FROM expenses WHERE expense_id = $1`, [expenseId]);
    return (result.rowCount ?? 0) > 0;
  },

  async listByGroup(groupId: number): Promise<ExpenseRecord[]> {
    const { rows } = await pool.query<ExpenseRecord>(
      `SELECT expense_id, group_id, title_description, total_amount::text, sale_date::text,
              payer_user_id, tax_amount::text, tip_amount::text, split_type, category, note,
              receipt_items_flag, receipt_image_url, created_at, updated_at
       FROM expenses
       WHERE group_id = $1
       ORDER BY sale_date DESC, expense_id DESC`,
      [groupId],
    );
    return rows;
  },

  async listSplits(expenseId: number): Promise<ExpenseSplitRecord[]> {
    const { rows } = await pool.query<ExpenseSplitRecord>(
      `SELECT split_id, expense_id, user_id, amount_owed::text, original_amount::text, percentage::text, share::text, is_settled
       FROM expense_splits
       WHERE expense_id = $1
       ORDER BY split_id ASC`,
      [expenseId],
    );
    return rows;
  },

  async listReceiptItems(expenseId: number): Promise<Array<ReceiptItemRecord & { assigned_user_ids: number[] }>> {
    const { rows } = await pool.query<ReceiptItemRecord & { assigned_user_ids: number[] }>(
      `SELECT ri.item_id,
              ri.expense_id,
              ri.item_name,
              ri.price::text,
              COALESCE(
                ARRAY_AGG(ria.user_id ORDER BY ria.user_id)
                  FILTER (WHERE ria.user_id IS NOT NULL),
                ARRAY[]::int[]
              ) AS assigned_user_ids
       FROM receipt_items ri
       LEFT JOIN receipt_item_assignments ria ON ria.item_id = ri.item_id
       WHERE ri.expense_id = $1
       GROUP BY ri.item_id, ri.expense_id, ri.item_name, ri.price
       ORDER BY ri.item_id ASC`,
      [expenseId],
    );
    return rows;
  },

  async listMemberDiscounts(expenseId: number): Promise<ExpenseMemberDiscountRecord[]> {
    const { rows } = await pool.query<ExpenseMemberDiscountRecord>(
      `SELECT
         expense_member_discount_id,
         expense_id,
         user_id,
         discount_type,
         rate_percent::text
       FROM expense_member_discounts
       WHERE expense_id = $1
       ORDER BY expense_member_discount_id ASC`,
      [expenseId],
    );
    return rows;
  },

  async belongsToGroup(expenseId: number, groupId: number): Promise<boolean> {
    const { rows } = await pool.query<{ ok: number }>(
      `SELECT 1 AS ok FROM expenses WHERE expense_id = $1 AND group_id = $2 LIMIT 1`,
      [expenseId, groupId],
    );
    return rows.length > 0;
  },

  async findById(expenseId: number): Promise<ExpenseRecord | null> {
    const { rows } = await pool.query<ExpenseRecord>(
      `SELECT expense_id, group_id, title_description, total_amount::text, sale_date::text,
              payer_user_id, tax_amount::text, tip_amount::text, split_type, category, note,
              receipt_items_flag, receipt_image_url, created_at, updated_at
       FROM expenses WHERE expense_id = $1`,
      [expenseId],
    );
    return rows[0] ?? null;
  },

  async findGroupIdByExpenseId(expenseId: number): Promise<number | null> {
    const { rows } = await pool.query<{ group_id: number }>(
      `SELECT group_id FROM expenses WHERE expense_id = $1`,
      [expenseId],
    );
    return rows[0]?.group_id ?? null;
  },

  async replaceExpenseSplits(expenseId: number, splits: CalculatedSplit[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM expense_splits WHERE expense_id = $1`, [expenseId]);

      for (const split of splits) {
        await client.query(
          `INSERT INTO expense_splits (expense_id, user_id, amount_owed, original_amount, percentage, share)
           VALUES ($1, $2, $3::numeric(10,2), $3::numeric(10,2), $4, $5::numeric(10,2))`,
          [expenseId, split.userId, split.amountOwed, split.percentage, split.share],
        );
      }

      await client.query(`UPDATE expenses SET updated_at = CURRENT_TIMESTAMP WHERE expense_id = $1`, [
        expenseId,
      ]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};
