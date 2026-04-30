import { pool } from "../../db/pool.js";

export interface UserRecord {
  user_id: number;
  email: string;
  name: string;
  password: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const USER_COLUMNS = `
  user_id,
  name,
  email,
  password,
  is_active,
  created_at,
  updated_at
`;

export const userRepository = {
  async findByEmail(email: string): Promise<UserRecord | null> {
    const { rows } = await pool.query<UserRecord>(
      `SELECT ${USER_COLUMNS} FROM users WHERE email = $1`,
      [email],
    );
    return rows[0] ?? null;
  },

  async findById(userId: number): Promise<UserRecord | null> {
    const { rows } = await pool.query<UserRecord>(
      `SELECT ${USER_COLUMNS} FROM users WHERE user_id = $1`,
      [userId],
    );
    return rows[0] ?? null;
  },

  async create(input: {
    email: string;
    name: string;
    passwordHash: string;
  }): Promise<UserRecord> {
    const { rows } = await pool.query<UserRecord>(
      `INSERT INTO users (email, name, password)
       VALUES ($1, $2, $3)
       RETURNING ${USER_COLUMNS}`,
      [input.email, input.name, input.passwordHash],
    );
    const created = rows[0];
    if (!created) {
      throw new Error("Failed to create user");
    }
    return created;
  },
};
