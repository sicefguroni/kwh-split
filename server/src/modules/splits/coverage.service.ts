import { pool } from "../../db/pool.js";
import type { CoverageEntry, CoverageFlow, CoverageService } from "./coverage";

export const coverageService: CoverageService = {
  async createCoverageEntries(
    expenseId: number,
    flows: CoverageFlow[],
    payerUserId: number,
  ): Promise<CoverageEntry[]> {
    const now = new Date();

    const values = flows.map((flow) => [
      expenseId,
      payerUserId,
      flow.coveredUserId,
      flow.amountCovered,
      false,
      now,
    ]);

    const result = await pool.query(
      `INSERT INTO coverage_entries (
        expense_id,
        payer_user_id,
        covered_user_id,
        amount_covered,
        is_settled,
        created_at
      ) VALUES ${flows.map((_, i) => `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`).join(", ")}
      ON CONFLICT (expense_id, payer_user_id, covered_user_id) DO NOTHING
      RETURNING id, expense_id, payer_user_id, covered_user_id,
                amount_covered, is_settled, created_at`,
      values.flat(),
    );

    return result.rows;
  },

  async settleCoverageEntries(
    expenseId: number,
    payerUserId: number,
    coveredUserId: number,
  ): Promise<boolean> {
    const result = await pool.query(
      `UPDATE coverage_entries
       SET is_settled = true
       WHERE expense_id = $1
         AND payer_user_id = $2
         AND covered_user_id = $3
         AND is_settled = false
       RETURNING id`,
      [expenseId, payerUserId, coveredUserId],
    );

    return result.rows.length > 0;
  },

  async getUnsettledCoverageEntries(expenseId: number): Promise<CoverageEntry[]> {
    const result = await pool.query(
      `SELECT id, expense_id, payer_user_id, covered_user_id,
                 amount_covered, is_settled, created_at
       FROM coverage_entries
       WHERE expense_id = $1
         AND is_settled = false
       ORDER BY created_at DESC`,
      [expenseId],
    );

    return result.rows;
  },
};
