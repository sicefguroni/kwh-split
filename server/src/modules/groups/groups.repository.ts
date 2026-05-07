import { pool } from "../../db/pool.js";

export interface GroupRecord {
  group_id: number;
  name: string;
  description: string | null;
  currency: string;
  created_at: Date;
  updated_at: Date;
}

export interface GroupMemberRecord {
  member_id: number;
  group_id: number;
  user_id: number;
  role: string;
  created_at: Date;
  updated_at: Date;
}

export interface GroupMemberWithNameRecord extends GroupMemberRecord {
  name: string;
}

const GROUP_COLUMNS = `
  group_id,
  name,
  description,
  currency,
  created_at,
  updated_at
`;
const GROUP_COLUMNS_WITH_ALIAS = `
  g.group_id,
  g.name,
  g.description,
  g.currency,
  g.created_at,
  g.updated_at
`;

const MEMBER_COLUMNS = `
  member_id,
  group_id,
  user_id,
  role,
  created_at,
  updated_at
`;

export const groupsRepository = {
  async createGroupWithOwner(input: {
    name: string;
    description?: string;
    currency: string;
    ownerUserId: number;
  }): Promise<GroupRecord> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const groupResult = await client.query<GroupRecord>(
        `INSERT INTO groups (name, description, currency)
         VALUES ($1, $2, $3)
         RETURNING ${GROUP_COLUMNS}`,
        [input.name, input.description ?? null, input.currency],
      );
      const group = groupResult.rows[0];
      if (!group) {
        throw new Error("Failed to create group");
      }
      await client.query(
        `INSERT INTO group_members (group_id, user_id, role)
         VALUES ($1, $2, 'admin')`,
        [group.group_id, input.ownerUserId],
      );
      await client.query("COMMIT");
      return group;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async listForUser(userId: number): Promise<Array<GroupRecord & { role: string }>> {
    const { rows } = await pool.query<Array<GroupRecord & { role: string }>[number]>(
      `SELECT ${GROUP_COLUMNS_WITH_ALIAS}, gm.role
       FROM groups g
       INNER JOIN group_members gm ON gm.group_id = g.group_id
       WHERE gm.user_id = $1
       ORDER BY g.updated_at DESC, g.group_id DESC`,
      [userId],
    );
    return rows;
  },

  async findForUser(groupId: number, userId: number): Promise<(GroupRecord & { role: string }) | null> {
    const { rows } = await pool.query<(GroupRecord & { role: string })>(
      `SELECT ${GROUP_COLUMNS_WITH_ALIAS}, gm.role
       FROM groups g
       INNER JOIN group_members gm ON gm.group_id = g.group_id
       WHERE g.group_id = $1 AND gm.user_id = $2`,
      [groupId, userId],
    );
    return rows[0] ?? null;
  },

  async countMembers(groupId: number): Promise<number> {
    const { rows } = await pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM group_members WHERE group_id = $1`,
      [groupId],
    );
    const raw = rows[0]?.total ?? "0";
    return Number.parseInt(raw, 10);
  },

  async addMember(groupId: number, userId: number, role = "member"): Promise<GroupMemberRecord | null> {
    const { rows } = await pool.query<GroupMemberRecord>(
      `INSERT INTO group_members (group_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (group_id, user_id) DO NOTHING
       RETURNING ${MEMBER_COLUMNS}`,
      [groupId, userId, role],
    );
    return rows[0] ?? null;
  },

  async listMembers(groupId: number): Promise<GroupMemberWithNameRecord[]> {
    const { rows } = await pool.query<GroupMemberWithNameRecord>(
      `SELECT gm.member_id, gm.group_id, gm.user_id, gm.role, gm.created_at, gm.updated_at, u.name
       FROM group_members gm
       INNER JOIN users u ON u.user_id = gm.user_id
       WHERE gm.group_id = $1
       ORDER BY gm.member_id ASC`,
      [groupId],
    );
    return rows;
  },

  async findActiveUserByName(name: string): Promise<{ user_id: number } | null> {
    const { rows } = await pool.query<{ user_id: number }>(
      `SELECT user_id
       FROM users
       WHERE LOWER(name) = LOWER($1) AND is_active = TRUE
       ORDER BY user_id ASC
       LIMIT 1`,
      [name],
    );
    return rows[0] ?? null;
  },

  async createActiveUserForTesting(name: string, passwordHash: string): Promise<{ user_id: number }> {
    const normalized = name
      .toLowerCase()
      .trim()
      .replaceAll(/[^a-z0-9]+/g, ".")
      .replaceAll(/^\.+|\.+$/g, "");
    const base = normalized.length > 0 ? normalized : "test.user";
    const email = `${base}+${Date.now()}@dev.local`;

    const { rows } = await pool.query<{ user_id: number }>(
      `INSERT INTO users (name, email, password, is_active)
       VALUES ($1, $2, $3, TRUE)
       RETURNING user_id`,
      [name.trim(), email, passwordHash],
    );
    const created = rows[0];
    if (!created) {
      throw new Error("Failed to create testing user");
    }
    return created;
  },

  async updateGroup(input: {
    groupId: number;
    userId: number;
    name: string;
    description?: string;
    currency: string;
  }): Promise<boolean> {
    const result = await pool.query(
      `UPDATE groups g
       SET name = $1,
           description = $2,
           currency = $3,
           updated_at = CURRENT_TIMESTAMP
       FROM group_members gm
       WHERE g.group_id = $4
         AND gm.group_id = g.group_id
         AND gm.user_id = $5
         AND gm.role = 'admin'`,
      [input.name, input.description ?? null, input.currency, input.groupId, input.userId],
    );
    return (result.rowCount ?? 0) > 0;
  },

  async deleteGroup(input: { groupId: number; userId: number }): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM groups g
       USING group_members gm
       WHERE g.group_id = $1
         AND gm.group_id = g.group_id
         AND gm.user_id = $2
         AND gm.role = 'admin'`,
      [input.groupId, input.userId],
    );
    return (result.rowCount ?? 0) > 0;
  },
};
