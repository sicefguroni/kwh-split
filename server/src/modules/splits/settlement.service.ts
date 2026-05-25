import { pool } from "../../db/pool.js";
import type { SettlementEvent, NetSettlement } from "./settlement";
import type { CoverageEntry } from "./coverage";
import { computeNetSettlements, generateSettlements, minimizeTransactions } from "./settlement.impl";

export const settlementService: {
  computeNetSettlements(
    splits: Split[],
    coverageEntries: CoverageEntry[],
  ): NetSettlement[];

  generateSettlements(
    splits: Split[],
    coverageEntries: CoverageEntry[],
  ): SettlementEvent[];

  minimizeTransactions(
    netSettlements: NetSettlement[],
    coverageEntries: CoverageEntry[],
  ): { userId: number; toUserId: number | null; amount: number }[];

  createSettlementEvent(
    expenseId: number,
    fromUserId: number,
    toUserId: number | null,
    amount: number,
  ): Promise<number>;

  confirmSettlementEvent(eventId: number): Promise<boolean>;

  getSettlementEvents(expenseId: number): Promise<SettlementEvent[]>;
} = {
  computeNetSettlements,
  generateSettlements,
  minimizeTransactions,

  async createSettlementEvent(
    expenseId: number,
    fromUserId: number,
    toUserId: number | null,
    amount: number,
  ): Promise<number> {
    const now = new Date();

    const result = await pool.query(
      `INSERT INTO settlement_events (
        expense_id,
        from_user_id,
        to_user_id,
        amount,
        is_settled,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id`,
      [expenseId, fromUserId, toUserId, amount, false, now],
    );

    return result.rows[0].id;
  },

  async confirmSettlementEvent(eventId: number): Promise<boolean> {
    const result = await pool.query(
      `UPDATE settlement_events
       SET is_settled = true
       WHERE id = $1
         AND is_settled = false
       RETURNING id`,
      [eventId],
    );

    return result.rows.length > 0;
  },

  async getSettlementEvents(expenseId: number): Promise<SettlementEvent[]> {
    const result = await pool.query(
      `SELECT id, expense_id, from_user_id, to_user_id,
                 amount, is_settled, created_at
       FROM settlement_events
       WHERE expense_id = $1
       ORDER BY created_at DESC`,
      [expenseId],
    );

    return result.rows;
  },
};

export type Split = {
  userId: number;
  amountOwed: number;
  originalAmount: number;
  discountApplied?: number;
};
