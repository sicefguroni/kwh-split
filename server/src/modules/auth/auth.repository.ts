import { pool } from "../../db/pool.js";

export interface UserRecord {
  user_id: number;
  email: string;
  name: string;
  password: string;
  is_active: boolean;
  avatar_url: string | null;
  email_verified: boolean | null;
  profile_image_url: string | null;
  bank_qr_url: string | null;
  discount_type: string;
  created_at: Date;
  updated_at: Date;
}

export type AuthProvider = "google";

export interface UserAuthProviderRecord {
  auth_provider_id: number;
  user_id: number;
  provider: AuthProvider;
  provider_user_id: string;
  provider_email: string | null;
  created_at: Date;
  updated_at: Date;
}

const USER_COLUMNS = `
  user_id,
  name,
  email,
  password,
  is_active,
  avatar_url,
  email_verified,
  profile_image_url,
  bank_qr_url,
  discount_type,
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
    avatarUrl?: string | null;
    emailVerified?: boolean | null;
  }): Promise<UserRecord> {
    const { rows } = await pool.query<UserRecord>(
      `INSERT INTO users (email, name, password, avatar_url, email_verified)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${USER_COLUMNS}`,
      [
        input.email,
        input.name,
        input.passwordHash,
        input.avatarUrl ?? null,
        input.emailVerified ?? null,
      ],
    );
    const created = rows[0];
    if (!created) {
      throw new Error("Failed to create user");
    }
    return created;
  },

  async findProviderIdentity(
    provider: AuthProvider,
    providerUserId: string,
  ): Promise<UserAuthProviderRecord | null> {
    const { rows } = await pool.query<UserAuthProviderRecord>(
      `SELECT auth_provider_id, user_id, provider, provider_user_id, provider_email, created_at, updated_at
       FROM user_auth_providers
       WHERE provider = $1 AND provider_user_id = $2`,
      [provider, providerUserId],
    );
    return rows[0] ?? null;
  },

  async attachProviderToUser(input: {
    userId: number;
    provider: AuthProvider;
    providerUserId: string;
    providerEmail?: string | null;
  }): Promise<UserAuthProviderRecord> {
    const { rows } = await pool.query<UserAuthProviderRecord>(
      `INSERT INTO user_auth_providers (user_id, provider, provider_user_id, provider_email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (provider, user_id)
       DO UPDATE SET
         provider_user_id = EXCLUDED.provider_user_id,
         provider_email = EXCLUDED.provider_email,
         updated_at = CURRENT_TIMESTAMP
       RETURNING auth_provider_id, user_id, provider, provider_user_id, provider_email, created_at, updated_at`,
      [input.userId, input.provider, input.providerUserId, input.providerEmail ?? null],
    );
    const linked = rows[0];
    if (!linked) {
      throw new Error("Failed to attach provider to user");
    }
    return linked;
  },

  async updateProfile(userId: number, input: {
    name?: string | undefined;
    profileImageUrl?: string | null | undefined;
    bankQrUrl?: string | null | undefined;
    discountType?: string | undefined;
  }): Promise<UserRecord> {
    const updates: string[] = [];
    const values: unknown[] = [userId];
    let paramCount = 2;

    if (input.name !== undefined) {
      updates.push(`name = $${paramCount}`);
      values.push(input.name);
      paramCount++;
    }
    if (input.profileImageUrl !== undefined) {
      updates.push(`profile_image_url = $${paramCount}`);
      values.push(input.profileImageUrl);
      paramCount++;
    }
    if (input.bankQrUrl !== undefined) {
      updates.push(`bank_qr_url = $${paramCount}`);
      values.push(input.bankQrUrl);
      paramCount++;
    }
    if (input.discountType !== undefined) {
      updates.push(`discount_type = $${paramCount}`);
      values.push(input.discountType);
      paramCount++;
    }

    if (updates.length === 0) {
      const result = await this.findById(userId);
      if (!result) {
        throw new Error("User not found");
      }
      return result;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    const { rows } = await pool.query<UserRecord>(
      `UPDATE users SET ${updates.join(", ")} WHERE user_id = $1 RETURNING ${USER_COLUMNS}`,
      values,
    );
    const updated = rows[0];
    if (!updated) {
      throw new Error("Failed to update user profile");
    }
    return updated;
  },
};
