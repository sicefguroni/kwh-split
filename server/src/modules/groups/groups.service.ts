import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { broadcastGroupChange, broadcastInvitationChange } from "../realtime/realtime-hub.js";
import { userRepository } from "../auth/auth.repository.js";
import { hashPassword } from "../../utils/password.js";
import { badRequest, tooManyRequests } from "../../utils/errors.js";
import { sendGroupInvitationEmail, type GroupInviteDeliveryStatus } from "./groups.mailer.js";
import {
  groupsRepository,
  type GroupInvitationWithContextRecord,
  type GroupNotificationRecord,
} from "./groups.repository.js";
import type {
  CreateGroupInput,
  CreateInvitationsInput,
  JoinGroupInput,
  UpdateGroupInput,
} from "./groups.schemas.js";

const INVITE_WINDOW_MS = 60 * 60 * 1000;
const MAX_INVITES_PER_WINDOW = 25;
const INVITATION_EXPIRY_DAYS = 7;

export interface PublicGroupInvitation {
  id: string;
  groupId: string;
  groupName: string;
  groupDescription: string | null;
  groupCurrency: string;
  groupImageUrl: string | null;
  memberCount: number;
  inviterName: string;
  inviteeEmail: string;
  inviteeName: string | null;
  inviteToken: string;
  status: "pending" | "accepted" | "declined" | "expired";
  createdAt: string;
  expiresAt: string;
}

export interface PublicInvitationBatchResult {
  created: Array<
    PublicGroupInvitation & {
      deliveryStatus: GroupInviteDeliveryStatus;
    }
  >;
  skipped: Array<{
    identifier: string;
    reason: string;
  }>;
}

export interface PublicInvitePreview {
  kind: "direct" | "public";
  token: string;
  inviterName: string | null;
  inviteeEmail: string | null;
  status: "pending" | "accepted" | "declined" | "expired" | "available";
  expiresAt: string | null;
  group: {
    id: string;
    name: string;
    description: string | null;
    currency: string;
    imageUrl: string | null;
    memberCount: number;
  };
}

export interface PublicCollaboratorSuggestion {
  userId: string;
  name: string;
  email: string;
  mutualGroups: number;
}

export interface PublicGroup {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  imageUrl: string | null;
  memberCount: number;
  role: string;
  members: Array<{ id: string; name: string; email: string; isAdmin: boolean }>;
  createdAt: string;
  inviteToken: string;
}

export interface PublicNotification {
  id: string;
  type: "group_invitation_accepted" | "group_invitation_declined";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  groupId: string | null;
  invitationId: string | null;
}

const toPublicGroup = (
  record: {
    group_id: number;
    name: string;
    description: string | null;
    currency: string;
    image_url: string | null;
    invite_token: string | null;
    created_at: Date;
  } & { role: string },
  memberCount: number,
): PublicGroup => ({
  id: String(record.group_id),
  name: record.name,
  description: record.description,
  currency: record.currency,
  imageUrl: record.image_url,
  memberCount,
  role: record.role,
  members: [],
  createdAt: record.created_at.toISOString(),
  inviteToken: record.invite_token ?? "",
});

const toPublicInvitation = (
  invitation: GroupInvitationWithContextRecord,
): PublicGroupInvitation => ({
  id: String(invitation.invitation_id),
  groupId: String(invitation.group_id),
  groupName: invitation.group_name,
  groupDescription: invitation.group_description,
  groupCurrency: invitation.group_currency,
  groupImageUrl: invitation.group_image_url,
  memberCount: invitation.member_count,
  inviterName: invitation.inviter_name,
  inviteeEmail: invitation.invitee_email,
  inviteeName: invitation.invitee_name,
  inviteToken: invitation.invite_token,
  status: invitation.status,
  createdAt: invitation.created_at.toISOString(),
  expiresAt: invitation.expires_at.toISOString(),
});

const toPublicNotification = (notification: GroupNotificationRecord): PublicNotification => ({
  id: String(notification.notification_id),
  type: notification.type,
  title: notification.title,
  message: notification.message,
  isRead: notification.is_read,
  createdAt: notification.created_at.toISOString(),
  groupId: notification.group_id !== null ? String(notification.group_id) : null,
  invitationId: notification.invitation_id !== null ? String(notification.invitation_id) : null,
});

const isInvitationExpired = (invitation: { status: string; expires_at: Date }): boolean =>
  invitation.status === "pending" && invitation.expires_at.getTime() < Date.now();

async function markExpiredIfNeeded(
  invitation: GroupInvitationWithContextRecord,
): Promise<GroupInvitationWithContextRecord> {
  if (!isInvitationExpired(invitation)) {
    return invitation;
  }

  await groupsRepository.updateInvitationStatus(invitation.invitation_id, "expired");
  return {
    ...invitation,
    status: "expired",
  };
}

async function requireActiveUser(userId: number): Promise<{ user_id: number; email: string; name: string }> {
  const user = await userRepository.findById(userId);
  if (!user || !user.is_active) {
    throw badRequest("User not found", "user_not_found");
  }
  return {
    user_id: user.user_id,
    email: user.email,
    name: user.name,
  };
}

async function buildPublicGroup(groupId: number, userId: number): Promise<PublicGroup> {
  const group = await groupsRepository.findForUser(groupId, userId);
  if (!group) {
    throw badRequest("Group not found", "group_not_found");
  }

  const members = await groupsRepository.listMembers(group.group_id);
  const publicGroup = toPublicGroup(group, members.length);
  return {
    ...publicGroup,
    members: members.map((member) => ({
      id: String(member.user_id),
      name: member.name,
      email: member.email,
      isAdmin: member.role === "admin",
    })),
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function createInvitationToken(): string {
  return `inv_${Date.now()}_${randomUUID().replaceAll("-", "")}`;
}

function invitationExpiresAt(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);
  return expiresAt;
}

export const groupsService = {
  async create(ownerUserId: number, input: CreateGroupInput): Promise<PublicGroup> {
    const group = await groupsRepository.createGroupWithOwner({
      name: input.name,
      currency: input.currency,
      ownerUserId,
      ...(input.description ? { description: input.description } : {}),
      ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
    });

    broadcastGroupChange(group.group_id);
    return buildPublicGroup(group.group_id, ownerUserId);
  },

  async listForUser(userId: number): Promise<PublicGroup[]> {
    const groups = await groupsRepository.listForUser(userId);
    const groupsWithMembers = await Promise.all(
      groups.map(async (group) => {
        const members = await groupsRepository.listMembers(group.group_id);
        const publicGroup = toPublicGroup(group, members.length);
        return {
          ...publicGroup,
          members: members.map((member) => ({
            id: String(member.user_id),
            name: member.name,
            email: member.email,
            isAdmin: member.role === "admin",
          })),
        };
      }),
    );

    return groupsWithMembers;
  },

  async getByIdForUser(groupId: number, userId: number): Promise<PublicGroup> {
    return buildPublicGroup(groupId, userId);
  },

  async join(groupId: number, requesterId: number, input: JoinGroupInput): Promise<void> {
    const group = await groupsRepository.findForUser(groupId, requesterId);
    if (!group) {
      throw badRequest("Only existing members can add users", "group_not_joinable");
    }
    if (group.role !== "admin") {
      throw badRequest("Only group admin can add users", "group_admin_required");
    }

    let targetUserId = input.userId;
    if (!targetUserId && input.userName) {
      const user = await groupsRepository.findActiveUserByName(input.userName);
      if (user) {
        targetUserId = user.user_id;
      } else if (env.NODE_ENV !== "production") {
        const passwordHash = await hashPassword(randomUUID());
        const created = await groupsRepository.createActiveUserForTesting(input.userName, passwordHash);
        targetUserId = created.user_id;
      } else {
        throw badRequest("No active user found with that name", "user_not_found");
      }
    }

    if (!targetUserId) {
      throw badRequest("Join target is missing", "missing_join_target");
    }

    const inserted = await groupsRepository.addMember(groupId, targetUserId);
    if (!inserted) {
      throw badRequest("User is already a member", "group_member_exists");
    }

    broadcastGroupChange(groupId);
  },

  async update(groupId: number, requesterId: number, input: UpdateGroupInput): Promise<PublicGroup> {
    const updated = await groupsRepository.updateGroup({
      groupId,
      userId: requesterId,
      name: input.name,
      currency: input.currency,
      ...(input.description ? { description: input.description } : {}),
      ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
    });
    if (!updated) {
      throw badRequest("Only group admin can update this group", "group_admin_required");
    }

    broadcastGroupChange(groupId);
    return buildPublicGroup(groupId, requesterId);
  },

  async remove(groupId: number, requesterId: number): Promise<void> {
    const deleted = await groupsRepository.deleteGroup({ groupId, userId: requesterId });
    if (!deleted) {
      throw badRequest("Only group admin can delete this group", "group_admin_required");
    }
  },

  async searchCollaborators(
    requesterId: number,
    query: string,
    excludeGroupId?: number,
  ): Promise<PublicCollaboratorSuggestion[]> {
    const trimmed = query.trim();
    if (trimmed.length < 1) {
      return [];
    }

    const suggestions = await groupsRepository.searchCollaborators(
      excludeGroupId
        ? {
            requesterUserId: requesterId,
            query: trimmed,
            excludeGroupId,
          }
        : {
            requesterUserId: requesterId,
            query: trimmed,
          },
    );

    return suggestions.map((suggestion) => ({
      userId: String(suggestion.user_id),
      name: suggestion.name,
      email: suggestion.email,
      mutualGroups: suggestion.mutual_group_count,
    }));
  },

  async createInvitations(
    groupId: number,
    inviterId: number,
    input: CreateInvitationsInput,
  ): Promise<PublicInvitationBatchResult> {
    const group = await groupsRepository.findForUser(groupId, inviterId);
    if (!group || group.role !== "admin") {
      throw badRequest("Only group admin can invite members", "group_admin_required");
    }

    const inviter = await requireActiveUser(inviterId);
    const invitesSentRecently = await groupsRepository.countInvitationsSentSince(
      inviterId,
      new Date(Date.now() - INVITE_WINDOW_MS),
    );
    if (invitesSentRecently + input.recipients.length > MAX_INVITES_PER_WINDOW) {
      throw tooManyRequests(
        `You can send up to ${MAX_INVITES_PER_WINDOW} invites per hour.`,
        "invite_limit_exceeded",
      );
    }

    const created: PublicInvitationBatchResult["created"] = [];
    const skipped: PublicInvitationBatchResult["skipped"] = [];

    for (const recipient of input.recipients) {
      let inviteeUserId: number | undefined;
      let inviteeEmail = "";
      let inviteeName: string | null = null;

      if (recipient.userId !== undefined) {
        const invitee = await groupsRepository.findActiveUserById(recipient.userId);
        if (!invitee) {
          skipped.push({
            identifier: `user:${recipient.userId}`,
            reason: "User not found.",
          });
          continue;
        }
        inviteeUserId = invitee.user_id;
        inviteeEmail = invitee.email;
        inviteeName = invitee.name;
      } else if (recipient.email) {
        inviteeEmail = normalizeEmail(recipient.email);
        const existingUser = await groupsRepository.findActiveUserByEmail(inviteeEmail);
        if (existingUser) {
          inviteeUserId = existingUser.user_id;
          inviteeName = existingUser.name;
          inviteeEmail = existingUser.email;
        }
      }

      const identifier = inviteeUserId !== undefined ? `user:${inviteeUserId}` : inviteeEmail;
      if (!inviteeEmail) {
        skipped.push({
          identifier,
          reason: "Recipient is missing an email address.",
        });
        continue;
      }

      if (inviteeUserId === inviterId || inviteeEmail === inviter.email.toLowerCase()) {
        skipped.push({
          identifier,
          reason: "You are already a member of this group.",
        });
        continue;
      }

      const alreadyMember =
        inviteeUserId !== undefined
          ? await groupsRepository.isUserMember(groupId, inviteeUserId)
          : await groupsRepository.isEmailMember(groupId, inviteeEmail);
      if (alreadyMember) {
        skipped.push({
          identifier,
          reason: "This person is already in the group.",
        });
        continue;
      }

      const existingInvitation = await groupsRepository.findPendingInvitation(
        inviteeUserId !== undefined
          ? {
              groupId,
              inviteeEmail,
              inviteeUserId,
            }
          : {
              groupId,
              inviteeEmail,
            },
      );
      if (existingInvitation) {
        skipped.push({
          identifier,
          reason: "A pending invite already exists.",
        });
        continue;
      }

      const invitation = await groupsRepository.createInvitation(
        inviteeUserId !== undefined
          ? {
              groupId,
              inviterUserId: inviterId,
              inviteeEmail,
              inviteeUserId,
              inviteToken: createInvitationToken(),
              expiresAt: invitationExpiresAt(),
            }
          : {
              groupId,
              inviterUserId: inviterId,
              inviteeEmail,
              inviteToken: createInvitationToken(),
              expiresAt: invitationExpiresAt(),
            },
      );

      const invitationRecord = await groupsRepository.findInvitationByToken(invitation.invite_token);
      if (!invitationRecord) {
        throw badRequest("Failed to load created invitation", "invitation_load_failed");
      }

      const deliveryStatus = await sendGroupInvitationEmail({
        to: inviteeEmail,
        inviterName: inviter.name,
        groupName: invitationRecord.group_name,
        inviteUrl: `${env.WEB_ORIGIN}/join/${invitation.invite_token}`,
        expiresAt: invitation.expires_at,
      });

      if (inviteeUserId !== undefined) {
        broadcastInvitationChange(inviteeUserId);
      }

      created.push({
        ...toPublicInvitation(invitationRecord),
        inviteeName,
        deliveryStatus,
      });
    }

    if (created.length > 0) {
      broadcastGroupChange(groupId);
    }

    return { created, skipped };
  },

  async listInvitations(groupId: number, userId: number): Promise<PublicGroupInvitation[]> {
    const group = await groupsRepository.findForUser(groupId, userId);
    if (!group) {
      throw badRequest("You are not a member of this group", "not_group_member");
    }

    const invitations = await groupsRepository.listInvitationsForGroup(groupId);
    const normalized = await Promise.all(invitations.map(markExpiredIfNeeded));
    return normalized.map(toPublicInvitation);
  },

  async listIncomingInvitations(userId: number): Promise<PublicGroupInvitation[]> {
    const user = await requireActiveUser(userId);
    const invitations = await groupsRepository.listIncomingInvitations({
      userId,
      email: user.email,
    });
    const normalized = await Promise.all(invitations.map(markExpiredIfNeeded));
    return normalized.map(toPublicInvitation);
  },

  async listNotifications(userId: number): Promise<PublicNotification[]> {
    const notifications = await groupsRepository.listNotificationsForUser(userId);
    return notifications.map(toPublicNotification);
  },

  async markNotificationsRead(userId: number): Promise<void> {
    await groupsRepository.markNotificationsRead(userId);
  },

  async acceptIncomingInvitation(
    invitationId: number,
    userId: number,
  ): Promise<{ group: PublicGroup; wasNewMember: boolean }> {
    const user = await requireActiveUser(userId);
    const invitation = await groupsRepository.findInvitationByIdForInvitee({
      invitationId,
      userId,
      email: user.email,
    });
    if (!invitation) {
      throw badRequest("Invitation not found", "invitation_not_found");
    }

    return groupsService.acceptInvitationRecord(invitation, userId, user.email, user.name);
  },

  async declineIncomingInvitation(invitationId: number, userId: number): Promise<void> {
    const user = await requireActiveUser(userId);
    const invitation = await groupsRepository.findInvitationByIdForInvitee({
      invitationId,
      userId,
      email: user.email,
    });
    if (!invitation) {
      throw badRequest("Invitation not found", "invitation_not_found");
    }

    const normalized = await markExpiredIfNeeded(invitation);
    if (normalized.status !== "pending") {
      throw badRequest("Only pending invitations can be declined", "invitation_processed");
    }

    await groupsRepository.updateInvitationStatus(normalized.invitation_id, "declined", userId);
    await groupsRepository.createNotification({
      userId: normalized.inviter_user_id,
      actorUserId: userId,
      groupId: normalized.group_id,
      invitationId: normalized.invitation_id,
      type: "group_invitation_declined",
      title: `${user.name} declined your invite`,
      message: `${user.name} declined the invitation to ${normalized.group_name}.`,
    });
    broadcastInvitationChange(userId);
    broadcastInvitationChange(normalized.inviter_user_id);
    broadcastGroupChange(normalized.group_id);
  },

  async previewInviteToken(token: string): Promise<PublicInvitePreview> {
    const invitation = await groupsRepository.findInvitationByToken(token);
    if (invitation) {
      const normalized = await markExpiredIfNeeded(invitation);
      return {
        kind: "direct",
        token,
        inviterName: normalized.inviter_name,
        inviteeEmail: normalized.invitee_email,
        status: normalized.status,
        expiresAt: normalized.expires_at.toISOString(),
        group: {
          id: String(normalized.group_id),
          name: normalized.group_name,
          description: normalized.group_description,
          currency: normalized.group_currency,
          imageUrl: normalized.group_image_url,
          memberCount: normalized.member_count,
        },
      };
    }

    const group = await groupsRepository.findGroupByInviteToken(token);
    if (!group) {
      throw badRequest("Invalid invite link", "invalid_invite_link");
    }

    const memberCount = await groupsRepository.countMembers(group.group_id);
    return {
      kind: "public",
      token,
      inviterName: null,
      inviteeEmail: null,
      status: "available",
      expiresAt: null,
      group: {
        id: String(group.group_id),
        name: group.name,
        description: group.description,
        currency: group.currency,
        imageUrl: group.image_url,
        memberCount,
      },
    };
  },

  async acceptInvitation(inviteToken: string, userId: number): Promise<{ group: PublicGroup; wasNewMember: boolean }> {
    return groupsService.acceptInviteToken(inviteToken, userId);
  },

  async acceptInviteToken(
    inviteToken: string,
    userId: number,
  ): Promise<{ group: PublicGroup; wasNewMember: boolean }> {
    const user = await requireActiveUser(userId);
    const invitation = await groupsRepository.findInvitationByToken(inviteToken);
    if (invitation) {
      return groupsService.acceptInvitationRecord(invitation, userId, user.email, user.name);
    }

    return groupsService.joinViaPublicLink(inviteToken, userId);
  },

  async getPublicInviteLink(groupId: number, userId: number): Promise<string | null> {
    const group = await groupsRepository.findForUser(groupId, userId);
    if (!group) {
      throw badRequest("You are not a member of this group", "not_group_member");
    }
    return group.invite_token;
  },

  async regenerateInviteLink(groupId: number, userId: number): Promise<string> {
    const group = await groupsRepository.findForUser(groupId, userId);
    if (!group || group.role !== "admin") {
      throw badRequest("Only group admin can regenerate invite link", "group_admin_required");
    }

    const newToken = await groupsRepository.regenerateInviteToken(groupId);
    if (!newToken) {
      throw badRequest("Failed to regenerate invite link", "regenerate_failed");
    }

    broadcastGroupChange(groupId);
    return newToken;
  },

  async joinViaPublicLink(
    inviteToken: string,
    userId: number,
  ): Promise<{ group: PublicGroup; wasNewMember: boolean }> {
    const group = await groupsRepository.findGroupByInviteToken(inviteToken);
    if (!group) {
      throw badRequest("Invalid invite link", "invalid_invite_link");
    }

    const inserted = await groupsRepository.addMember(group.group_id, userId);
    const wasNewMember = inserted !== null;

    broadcastGroupChange(group.group_id);
    const fullGroup = await buildPublicGroup(group.group_id, userId);
    return { group: fullGroup, wasNewMember };
  },

  async acceptInvitationRecord(
    invitation: GroupInvitationWithContextRecord,
    userId: number,
    userEmail: string,
    userName: string,
  ): Promise<{ group: PublicGroup; wasNewMember: boolean }> {
    const normalized = await markExpiredIfNeeded(invitation);
    if (normalized.status !== "pending") {
      throw badRequest("Invitation has already been processed", "invitation_processed");
    }

    if (
      normalized.invitee_user_id !== null &&
      normalized.invitee_user_id !== userId
    ) {
      throw badRequest("This invitation belongs to another user", "invitation_recipient_mismatch");
    }

    if (
      normalized.invitee_user_id === null &&
      normalizeEmail(normalized.invitee_email) !== normalizeEmail(userEmail)
    ) {
      throw badRequest(
        `This invitation was sent to ${normalized.invitee_email}.`,
        "invitation_recipient_mismatch",
      );
    }

    const inserted = await groupsRepository.addMember(normalized.group_id, userId);
    const wasNewMember = inserted !== null;

    await groupsRepository.updateInvitationStatus(normalized.invitation_id, "accepted", userId);
    await groupsRepository.createNotification({
      userId: normalized.inviter_user_id,
      actorUserId: userId,
      groupId: normalized.group_id,
      invitationId: normalized.invitation_id,
      type: "group_invitation_accepted",
      title: `${userName} accepted your invite`,
      message: `${userName} joined ${normalized.group_name}.`,
    });
    broadcastInvitationChange(userId);
    broadcastInvitationChange(normalized.inviter_user_id);
    broadcastGroupChange(normalized.group_id);

    const group = await buildPublicGroup(normalized.group_id, userId);
    return { group, wasNewMember };
  },
};
