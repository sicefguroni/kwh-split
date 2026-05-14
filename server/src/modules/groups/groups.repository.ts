import { pool } from "../../db/pool.js";

export interface GroupRecord {
  group_id: number;
  name: string;
  description: string | null;
  currency: string;
  image_url: string | null;
  invite_token: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface GroupMemberRecord {
  member_id: number;
  group_id: number;
  user_id: number;
  role: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface GroupMemberWithNameRecord extends GroupMemberRecord {
  name: string;
  email: string;
  discount_type: string;
}

export interface GroupInvitationRecord {
  invitation_id: number;
  group_id: number;
  inviter_user_id: number;
  invitee_email: string;
  invitee_user_id: number | null;
  status: "pending" | "accepted" | "declined" | "expired";
  invite_token: string;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface GroupInvitationWithContextRecord extends GroupInvitationRecord {
  inviter_name: string;
  invitee_name: string | null;
  group_name: string;
  group_description: string | null;
  group_currency: string;
  group_image_url: string | null;
  member_count: number;
}

export interface GroupNotificationRecord {
  notification_id: number;
  user_id: number;
  actor_user_id: number | null;
  group_id: number | null;
  invitation_id: number | null;
  type: "group_invitation_accepted" | "group_invitation_declined" | "group_deleted" | "member_left" | "admin_transferred" | "member_joined" | "expense_added" | "expense_deleted" | "settlement_paid";
  title: string;
  message: string;
  is_read: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CollaboratorSuggestionRecord {
  user_id: number;
  name: string;
  email: string;
  mutual_group_count: number;
  last_collaborated_at: Date | null;
}

const GROUP_COLUMNS = `
  group_id,
  name,
  description,
  currency,
  image_url,
  invite_token,
  created_at,
  updated_at
`;

const GROUP_COLUMNS_WITH_ALIAS = `
  g.group_id,
  g.name,
  g.description,
  g.currency,
  g.image_url,
  g.invite_token,
  g.created_at,
  g.updated_at
`;

const MEMBER_COLUMNS = `
  member_id,
  group_id,
  user_id,
  role,
  is_active,
  created_at,
  updated_at
`;

const INVITATION_COLUMNS = `
  invitation_id,
  group_id,
  inviter_user_id,
  invitee_email,
  invitee_user_id,
  status,
  invite_token,
  expires_at,
  created_at,
  updated_at
`;

const INVITATION_COLUMNS_WITH_ALIAS = `
  gi.invitation_id,
  gi.group_id,
  gi.inviter_user_id,
  gi.invitee_email,
  gi.invitee_user_id,
  gi.status,
  gi.invite_token,
  gi.expires_at,
  gi.created_at,
  gi.updated_at
`;

const INVITATION_WITH_CONTEXT_SELECT = `
  ${INVITATION_COLUMNS_WITH_ALIAS},
  inviter.name AS inviter_name,
  invitee.name AS invitee_name,
  g.name AS group_name,
  g.description AS group_description,
  g.currency AS group_currency,
  g.image_url AS group_image_url,
  (
    SELECT COUNT(*)::int
    FROM group_members gm_count
    WHERE gm_count.group_id = gi.group_id AND gm_count.is_active = TRUE
  ) AS member_count
`;

const NOTIFICATION_COLUMNS = `
  notification_id,
  user_id,
  actor_user_id,
  group_id,
  invitation_id,
  type,
  title,
  message,
  is_read,
  created_at,
  updated_at
`;

export const groupsRepository = {
  async createGroupWithOwner(input: {
    name: string;
    description?: string;
    currency: string;
    imageUrl?: string;
    ownerUserId: number;
  }): Promise<GroupRecord> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const inviteToken = `invite_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
      const groupResult = await client.query<GroupRecord>(
        `INSERT INTO groups (name, description, currency, image_url, invite_token)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${GROUP_COLUMNS}`,
        [
          input.name,
          input.description ?? null,
          input.currency,
          input.imageUrl ?? null,
          inviteToken,
        ],
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
       WHERE gm.user_id = $1 AND gm.is_active = TRUE
       ORDER BY g.updated_at DESC, g.group_id DESC`,
      [userId],
    );
    return rows;
  },

  async findForUser(
    groupId: number,
    userId: number,
  ): Promise<(GroupRecord & { role: string }) | null> {
    const { rows } = await pool.query<GroupRecord & { role: string }>(
      `SELECT ${GROUP_COLUMNS_WITH_ALIAS}, gm.role
       FROM groups g
       INNER JOIN group_members gm ON gm.group_id = g.group_id
       WHERE g.group_id = $1 AND gm.user_id = $2 AND gm.is_active = TRUE`,
      [groupId, userId],
    );
    return rows[0] ?? null;
  },

  async findById(groupId: number): Promise<GroupRecord | null> {
    const { rows } = await pool.query<GroupRecord>(
      `SELECT ${GROUP_COLUMNS}
       FROM groups
       WHERE group_id = $1`,
      [groupId],
    );
    return rows[0] ?? null;
  },

  async countMembers(groupId: number): Promise<number> {
    const { rows } = await pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM group_members
       WHERE group_id = $1 AND is_active = TRUE`,
      [groupId],
    );
    return rows[0]?.total ?? 0;
  },

  async addMember(groupId: number, userId: number, role = "member"): Promise<GroupMemberRecord | null> {
    const { rows } = await pool.query<GroupMemberRecord>(
      `INSERT INTO group_members (group_id, user_id, role, is_active)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (group_id, user_id) DO UPDATE
         SET is_active = TRUE, role = EXCLUDED.role, updated_at = CURRENT_TIMESTAMP
       RETURNING ${MEMBER_COLUMNS}`,
      [groupId, userId, role],
    );
    return rows[0] ?? null;
  },

  async transferAdmin(groupId: number, fromUserId: number, toUserId: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const demote = await client.query(
        `UPDATE group_members SET role = 'member', updated_at = CURRENT_TIMESTAMP
         WHERE group_id = $1 AND user_id = $2 AND role = 'admin'`,
        [groupId, fromUserId],
      );
      if ((demote.rowCount ?? 0) === 0) {
        await client.query("ROLLBACK");
        return false;
      }
      const promote = await client.query(
        `UPDATE group_members SET role = 'admin', updated_at = CURRENT_TIMESTAMP
         WHERE group_id = $1 AND user_id = $2`,
        [groupId, toUserId],
      );
      if ((promote.rowCount ?? 0) === 0) {
        await client.query("ROLLBACK");
        return false;
      }
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async removeMember(groupId: number, userId: number): Promise<boolean> {
    const result = await pool.query(
      `UPDATE group_members
       SET is_active = FALSE, role = 'member', updated_at = CURRENT_TIMESTAMP
       WHERE group_id = $1 AND user_id = $2 AND is_active = TRUE`,
      [groupId, userId],
    );
    return (result.rowCount ?? 0) > 0;
  },

  async promoteToAdmin(groupId: number, userId: number): Promise<boolean> {
    const result = await pool.query(
      `UPDATE group_members
       SET role = 'admin', updated_at = CURRENT_TIMESTAMP
       WHERE group_id = $1 AND user_id = $2 AND is_active = TRUE AND role = 'member'`,
      [groupId, userId],
    );
    return (result.rowCount ?? 0) > 0;
  },

  async isUserMember(groupId: number, userId: number): Promise<boolean> {
    const { rows } = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1
         FROM group_members
         WHERE group_id = $1 AND user_id = $2 AND is_active = TRUE
       ) AS exists`,
      [groupId, userId],
    );
    return rows[0]?.exists ?? false;
  },

  async isEmailMember(groupId: number, email: string): Promise<boolean> {
    const { rows } = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1
         FROM group_members gm
         INNER JOIN users u ON u.user_id = gm.user_id
         WHERE gm.group_id = $1 AND LOWER(u.email) = LOWER($2) AND gm.is_active = TRUE
       ) AS exists`,
      [groupId, email],
    );
    return rows[0]?.exists ?? false;
  },

  async listMembers(groupId: number): Promise<GroupMemberWithNameRecord[]> {
    const { rows } = await pool.query<GroupMemberWithNameRecord>(
      `SELECT gm.member_id, gm.group_id, gm.user_id, gm.role, gm.is_active, gm.created_at, gm.updated_at,
              u.name, u.email, COALESCE(u.discount_type, 'none') AS discount_type
       FROM group_members gm
       INNER JOIN users u ON u.user_id = gm.user_id
       WHERE gm.group_id = $1 AND gm.is_active = TRUE
       ORDER BY gm.member_id ASC`,
      [groupId],
    );
    return rows;
  },

  async listAllMembers(groupId: number): Promise<GroupMemberWithNameRecord[]> {
    const { rows } = await pool.query<GroupMemberWithNameRecord>(
      `SELECT gm.member_id, gm.group_id, gm.user_id, gm.role, gm.is_active, gm.created_at, gm.updated_at,
              u.name, u.email, COALESCE(u.discount_type, 'none') AS discount_type
       FROM group_members gm
       INNER JOIN users u ON u.user_id = gm.user_id
       WHERE gm.group_id = $1
       ORDER BY gm.is_active DESC, gm.member_id ASC`,
      [groupId],
    );
    return rows;
  },

  async findActiveUserByName(name: string): Promise<{ user_id: number; email: string; name: string } | null> {
    const { rows } = await pool.query<{ user_id: number; email: string; name: string }>(
      `SELECT user_id, email, name
       FROM users
       WHERE LOWER(name) = LOWER($1) AND is_active = TRUE
       ORDER BY user_id ASC
       LIMIT 1`,
      [name],
    );
    return rows[0] ?? null;
  },

  async findActiveUserByEmail(email: string): Promise<{ user_id: number; email: string; name: string } | null> {
    const { rows } = await pool.query<{ user_id: number; email: string; name: string }>(
      `SELECT user_id, email, name
       FROM users
       WHERE LOWER(email) = LOWER($1) AND is_active = TRUE
       LIMIT 1`,
      [email],
    );
    return rows[0] ?? null;
  },

  async findActiveUserById(userId: number): Promise<{ user_id: number; email: string; name: string } | null> {
    const { rows } = await pool.query<{ user_id: number; email: string; name: string }>(
      `SELECT user_id, email, name
       FROM users
       WHERE user_id = $1 AND is_active = TRUE`,
      [userId],
    );
    return rows[0] ?? null;
  },

  async searchCollaborators(input: {
    requesterUserId: number;
    query: string;
    excludeGroupId?: number;
    limit?: number;
  }): Promise<CollaboratorSuggestionRecord[]> {
    const search = `%${input.query.trim().toLowerCase()}%`;
    const { rows } = await pool.query<CollaboratorSuggestionRecord>(
      `SELECT
         collaborator.user_id,
         collaborator.name,
         collaborator.email,
         COUNT(DISTINCT mine.group_id)::int AS mutual_group_count,
         MAX(shared_group.updated_at) AS last_collaborated_at
       FROM group_members mine
       INNER JOIN group_members collaborator_members
         ON collaborator_members.group_id = mine.group_id
        AND collaborator_members.user_id <> mine.user_id
        AND collaborator_members.is_active = TRUE
       INNER JOIN users collaborator
         ON collaborator.user_id = collaborator_members.user_id
        AND collaborator.is_active = TRUE
       INNER JOIN groups shared_group
         ON shared_group.group_id = mine.group_id
       LEFT JOIN group_members excluded_group_member
         ON excluded_group_member.group_id = $3
        AND excluded_group_member.user_id = collaborator.user_id
        AND excluded_group_member.is_active = TRUE
       WHERE mine.user_id = $1
         AND mine.is_active = TRUE
         AND ($3::int IS NULL OR excluded_group_member.user_id IS NULL)
         AND (
           LOWER(collaborator.name) LIKE $2
           OR LOWER(collaborator.email) LIKE $2
         )
       GROUP BY collaborator.user_id, collaborator.name, collaborator.email
       ORDER BY mutual_group_count DESC, last_collaborated_at DESC NULLS LAST, collaborator.name ASC
       LIMIT $4`,
      [input.requesterUserId, search, input.excludeGroupId ?? null, input.limit ?? 8],
    );
    return rows;
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
    imageUrl?: string;
  }): Promise<boolean> {
    const result = await pool.query(
      `UPDATE groups g
       SET name = $1,
           description = $2,
           currency = $3,
           image_url = $4,
           updated_at = CURRENT_TIMESTAMP
       FROM group_members gm
       WHERE g.group_id = $5
         AND gm.group_id = g.group_id
         AND gm.user_id = $6
         AND gm.role = 'admin'
         AND gm.is_active = TRUE`,
      [
        input.name,
        input.description ?? null,
        input.currency,
        input.imageUrl ?? null,
        input.groupId,
        input.userId,
      ],
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

  async countInvitationsSentSince(inviterUserId: number, since: Date): Promise<number> {
    const { rows } = await pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM group_invitations
       WHERE inviter_user_id = $1
         AND created_at >= $2`,
      [inviterUserId, since],
    );
    return rows[0]?.total ?? 0;
  },

  async findPendingInvitation(input: {
    groupId: number;
    inviteeEmail: string;
    inviteeUserId?: number;
  }): Promise<GroupInvitationRecord | null> {
    const { rows } = await pool.query<GroupInvitationRecord>(
      `SELECT ${INVITATION_COLUMNS}
       FROM group_invitations
       WHERE group_id = $1
         AND status = 'pending'
         AND (
           LOWER(invitee_email) = LOWER($2)
           OR ($3::int IS NOT NULL AND invitee_user_id = $3)
         )
       ORDER BY created_at DESC
       LIMIT 1`,
      [input.groupId, input.inviteeEmail, input.inviteeUserId ?? null],
    );
    return rows[0] ?? null;
  },

  async createInvitation(input: {
    groupId: number;
    inviterUserId: number;
    inviteeEmail: string;
    inviteeUserId?: number;
    inviteToken: string;
    expiresAt: Date;
  }): Promise<GroupInvitationRecord> {
    const { rows } = await pool.query<GroupInvitationRecord>(
      `INSERT INTO group_invitations (
         group_id,
         inviter_user_id,
         invitee_email,
         invitee_user_id,
         invite_token,
         expires_at
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${INVITATION_COLUMNS}`,
      [
        input.groupId,
        input.inviterUserId,
        input.inviteeEmail,
        input.inviteeUserId ?? null,
        input.inviteToken,
        input.expiresAt,
      ],
    );
    const invitation = rows[0];
    if (!invitation) {
      throw new Error("Failed to create invitation");
    }
    return invitation;
  },

  async findInvitationByToken(token: string): Promise<GroupInvitationWithContextRecord | null> {
    const { rows } = await pool.query<GroupInvitationWithContextRecord>(
      `SELECT ${INVITATION_WITH_CONTEXT_SELECT}
       FROM group_invitations gi
       INNER JOIN groups g ON g.group_id = gi.group_id
       INNER JOIN users inviter ON inviter.user_id = gi.inviter_user_id
       LEFT JOIN users invitee ON invitee.user_id = gi.invitee_user_id
       WHERE gi.invite_token = $1`,
      [token],
    );
    return rows[0] ?? null;
  },

  async findInvitationByIdForInvitee(input: {
    invitationId: number;
    userId: number;
    email: string;
  }): Promise<GroupInvitationWithContextRecord | null> {
    const { rows } = await pool.query<GroupInvitationWithContextRecord>(
      `SELECT ${INVITATION_WITH_CONTEXT_SELECT}
       FROM group_invitations gi
       INNER JOIN groups g ON g.group_id = gi.group_id
       INNER JOIN users inviter ON inviter.user_id = gi.inviter_user_id
       LEFT JOIN users invitee ON invitee.user_id = gi.invitee_user_id
       WHERE gi.invitation_id = $1
         AND (
           gi.invitee_user_id = $2
           OR LOWER(gi.invitee_email) = LOWER($3)
         )`,
      [input.invitationId, input.userId, input.email],
    );
    return rows[0] ?? null;
  },

  async updateInvitationStatus(
    invitationId: number,
    status: "pending" | "accepted" | "declined" | "expired" | "left",
    inviteeUserId?: number,
  ): Promise<boolean> {
    const result = await pool.query(
      `UPDATE group_invitations
       SET status = $1,
           invitee_user_id = COALESCE($2, invitee_user_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE invitation_id = $3`,
      [status, inviteeUserId ?? null, invitationId],
    );
    return (result.rowCount ?? 0) > 0;
  },

  async updateInvitationStatusByMembership(
    groupId: number,
    userId: number,
    status: "left",
  ): Promise<number> {
    const result = await pool.query(
      `UPDATE group_invitations
       SET status = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE group_id = $2
         AND invitee_user_id = $3
         AND status = 'accepted'`,
      [status, groupId, userId],
    );
    return result.rowCount ?? 0;
  },

  async listInvitationsForGroup(groupId: number): Promise<GroupInvitationWithContextRecord[]> {
    const { rows } = await pool.query<GroupInvitationWithContextRecord>(
      `SELECT ${INVITATION_WITH_CONTEXT_SELECT}
       FROM group_invitations gi
       INNER JOIN groups g ON g.group_id = gi.group_id
       INNER JOIN users inviter ON inviter.user_id = gi.inviter_user_id
       LEFT JOIN users invitee ON invitee.user_id = gi.invitee_user_id
       WHERE gi.group_id = $1
       ORDER BY gi.created_at DESC`,
      [groupId],
    );
    return rows;
  },

  async listIncomingInvitations(input: {
    userId: number;
    email: string;
  }): Promise<GroupInvitationWithContextRecord[]> {
    const { rows } = await pool.query<GroupInvitationWithContextRecord>(
      `SELECT ${INVITATION_WITH_CONTEXT_SELECT}
       FROM group_invitations gi
       INNER JOIN groups g ON g.group_id = gi.group_id
       INNER JOIN users inviter ON inviter.user_id = gi.inviter_user_id
       LEFT JOIN users invitee ON invitee.user_id = gi.invitee_user_id
       WHERE gi.status IN ('pending', 'accepted', 'declined')
         AND (
           gi.invitee_user_id = $1
           OR LOWER(gi.invitee_email) = LOWER($2)
         )
       ORDER BY
         CASE gi.status
           WHEN 'pending' THEN 0
           WHEN 'accepted' THEN 1
           WHEN 'declined' THEN 2
           ELSE 3
         END,
         gi.created_at DESC`,
      [input.userId, input.email],
    );
    return rows;
  },

  async createNotification(input: {
    userId: number;
    actorUserId?: number;
    groupId?: number;
    invitationId?: number;
    type: "group_invitation_accepted" | "group_invitation_declined" | "group_deleted" | "member_left" | "admin_transferred" | "member_joined" | "expense_added" | "expense_deleted" | "settlement_paid";
    title: string;
    message: string;
  }): Promise<GroupNotificationRecord> {
    const { rows } = await pool.query<GroupNotificationRecord>(
      `INSERT INTO group_notifications (
         user_id,
         actor_user_id,
         group_id,
         invitation_id,
         type,
         title,
         message
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${NOTIFICATION_COLUMNS}`,
      [
        input.userId,
        input.actorUserId ?? null,
        input.groupId ?? null,
        input.invitationId ?? null,
        input.type,
        input.title,
        input.message,
      ],
    );
    const notification = rows[0];
    if (!notification) {
      throw new Error("Failed to create notification");
    }
    return notification;
  },

  async listNotificationsForUser(userId: number, limit = 20): Promise<GroupNotificationRecord[]> {
    const { rows } = await pool.query<GroupNotificationRecord>(
      `SELECT ${NOTIFICATION_COLUMNS}
       FROM group_notifications
       WHERE user_id = $1
       ORDER BY created_at DESC, notification_id DESC
       LIMIT $2`,
      [userId, limit],
    );
    return rows;
  },

  async markNotificationsRead(userId: number): Promise<number> {
    const result = await pool.query(
      `UPDATE group_notifications
       SET is_read = TRUE,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
         AND is_read = FALSE`,
      [userId],
    );
    return result.rowCount ?? 0;
  },

  async clearNotifications(
    userId: number,
    category?: "invitations" | "activity",
  ): Promise<number> {
    const invitationTypes = "'group_invitation_accepted', 'group_invitation_declined'";
    let query: string;
    if (category === "invitations") {
      query = `DELETE FROM group_notifications WHERE user_id = $1 AND type IN (${invitationTypes})`;
    } else if (category === "activity") {
      query = `DELETE FROM group_notifications WHERE user_id = $1 AND type NOT IN (${invitationTypes})`;
    } else {
      query = `DELETE FROM group_notifications WHERE user_id = $1`;
    }
    const result = await pool.query(query, [userId]);
    return result.rowCount ?? 0;
  },

  async findGroupByInviteToken(token: string): Promise<GroupRecord | null> {
    const { rows } = await pool.query<GroupRecord>(
      `SELECT ${GROUP_COLUMNS}
       FROM groups
       WHERE invite_token = $1`,
      [token],
    );
    return rows[0] ?? null;
  },

  async regenerateInviteToken(groupId: number): Promise<string | null> {
    const newToken = `invite_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
    const result = await pool.query(
      `UPDATE groups
       SET invite_token = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE group_id = $2`,
      [newToken, groupId],
    );
    return (result.rowCount ?? 0) > 0 ? newToken : null;
  },
};
