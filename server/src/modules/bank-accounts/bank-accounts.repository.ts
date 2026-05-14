import { pool } from "../../db/pool.js";

export interface BankAccountRecord {
  bank_account_id: number;
  user_id: number;
  bank_name: string;
  account_number: string;
  created_at: Date;
}

export const bankAccountsRepository = {
  async listByUserId(userId: number): Promise<BankAccountRecord[]> {
    const { rows } = await pool.query<BankAccountRecord>(
      `SELECT bank_account_id, user_id, bank_name, account_number, created_at
       FROM user_bank_accounts
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [userId],
    );
    return rows;
  },

  async create(userId: number, bankName: string, accountNumber: string): Promise<BankAccountRecord> {
    const { rows } = await pool.query<BankAccountRecord>(
      `INSERT INTO user_bank_accounts (user_id, bank_name, account_number)
       VALUES ($1, $2, $3)
       RETURNING bank_account_id, user_id, bank_name, account_number, created_at`,
      [userId, bankName, accountNumber],
    );
    return rows[0]!;
  },

  async deleteById(bankAccountId: number, userId: number): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM user_bank_accounts WHERE bank_account_id = $1 AND user_id = $2`,
      [bankAccountId, userId],
    );
    return (result.rowCount ?? 0) > 0;
  },
};
