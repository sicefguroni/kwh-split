import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { broadcastGroupChange, broadcastInvitationChange } from "../realtime/realtime-hub.js";
import { userRepository } from "../auth/auth.repository.js";
import { hashPassword } from "../../utils/password.js";
import { displayName } from "../../utils/display-name.js";
import { badRequest, tooManyRequests } from "../../utils/errors.js";
import { sendGroupInvitationEmail } from "./groups.mailer.js";
import {
  groupsRepository,
  type GroupInvitationWithContextRecord,
} from "./groups.repository.js";
import type { CreateGroupInput, CreateInvitationsInput, JoinGroupInput, UpdateGroupInput } from "./groups.schemas.js";
import type {
  PublicCollaboratorSuggestion,
  PublicGroup,
  PublicGroupInvitation,
  PublicInvitationBatchResult,
  PublicInvitePreview,
  PublicNotification,
} from "./groups.public-types.js";
import {
  createInvitationToken,
  invitationExpiresAt,
  INVITE_WINDOW_MS,
  MAX_INVITES_PER_WINDOW,
  normalizeEmail,
} from "./groups.invitation-constants.js";
import {
  markExpiredIfNeeded,
  membersToPublicRoles,
  toPublicGroup,
  toPublicInvitation,
  toPublicNotification,
} from "./groups.public-mapping.js";

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

  const allMembers = await groupsRepository.listAllMembers(group.group_id);
  const activeCount = allMembers.filter((m) => m.is_active).length;
  const publicGroup = toPublicGroup(group, activeCount);
  return {
    ...publicGroup,
    members: membersToPublicRoles(allMembers),
  };
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
        const allMembers = await groupsRepository.listAllMembers(group.group_id);
        const activeCount = allMembers.filter((m) => m.is_active).length;
        const publicGroup = toPublicGroup(group, activeCount);
        return {
          ...publicGroup,
          members: membersToPublicRoles(allMembers),
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
        const alreadyMember = await groupsRepository.isUserMember(groupId, user.user_id);
        if (alreadyMember && env.NODE_ENV !== "production") {
          const passwordHash = await hashPassword(randomUUID());
          const created = await groupsRepository.createActiveUserForTesting(input.userName, passwordHash);
          targetUserId = created.user_id;
        } else {
          targetUserId = user.user_id;
        }
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
    const group = await groupsRepository.findById(groupId);
    const members = group ? await groupsRepository.listMembers(groupId) : [];

    const deleted = await groupsRepository.deleteGroup({ groupId, userId: requesterId });
    if (!deleted) {
      throw badRequest("Only group admin can delete this group", "group_admin_required");
    }

    const otherMembers = members.filter((m) => m.user_id !== requesterId);
    const groupName = group?.name ?? "a group";
    const requester = members.find((m) => m.user_id === requesterId);
    const requesterLabel = requester ? displayName(requester, members) : "An admin";

    await Promise.all(
      otherMembers.map((member) =>
        groupsRepository.createNotification({
          userId: member.user_id,
          actorUserId: requesterId,
          type: "group_deleted",
          title: `${groupName} was deleted`,
          message: `${requesterLabel} deleted the group "${groupName}".`,
        }),
      ),
    );

    for (const member of otherMembers) {
      broadcastInvitationChange(member.user_id);
    }
  },

  async promoteToAdmin(groupId: number, requesterId: number, targetUserId: number): Promise<void> {
    const membership = await groupsRepository.findForUser(groupId, requesterId);
    if (!membership) {
      throw badRequest("You are not a member of this group", "not_a_member");
    }
    if (membership.role !== "admin") {
      throw badRequest("Only admins can promote members", "not_admin");
    }
    const targetIsMember = await groupsRepository.isUserMember(groupId, targetUserId);
    if (!targetIsMember) {
      throw badRequest("Target user is not an active member", "target_not_member");
    }

    const promoted = await groupsRepository.promoteToAdmin(groupId, targetUserId);
    if (!promoted) {
      throw badRequest("User is already an admin", "already_admin");
    }

    broadcastGroupChange(groupId);

    void (async () => {
      try {
        const members = await groupsRepository.listMembers(groupId);
        const actor = members.find((m) => m.user_id === requesterId);
        const target = members.find((m) => m.user_id === targetUserId);
        if (!actor || !target) return;
        const actorLabel = displayName(actor, members);
        const targetLabel = displayName(target, members);

        await groupsRepository.createNotification({
          userId: targetUserId,
          actorUserId: requesterId,
          groupId,
          type: "admin_transferred",
          title: "You are now an admin",
          message: `${actorLabel} promoted you to admin in "${membership.name}".`,
        });

        const otherMembers = members.filter((m) => m.user_id !== targetUserId && m.user_id !== requesterId);
        await Promise.all(
          otherMembers.map((m) =>
            groupsRepository.createNotification({
              userId: m.user_id,
              actorUserId: requesterId,
              groupId,
              type: "admin_transferred",
              title: `${targetLabel} is now admin`,
              message: `${actorLabel} promoted ${targetLabel} to admin in "${membership.name}".`,
            }),
          ),
        );

        for (const m of members) {
          broadcastInvitationChange(m.user_id);
        }
      } catch {
        // fire-and-forget
      }
    })();
  },

  async leaveGroup(groupId: number, requesterId: number, newAdminUserId?: number): Promise<void> {
    const membership = await groupsRepository.findForUser(groupId, requesterId);
    if (!membership) {
      throw badRequest("You are not a member of this group", "not_a_member");
    }

    const members = await groupsRepository.listMembers(groupId);
    const requester = members.find((m) => m.user_id === requesterId);
    const requesterName = requester ? displayName(requester, members) : "Someone";
    const groupName = membership.name;
    let didTransfer = false;
    let newAdminName: string | undefined;

    if (membership.role === "admin") {
      const otherAdmins = members.filter((m) => m.role === "admin" && m.user_id !== requesterId);
      const isSoleAdmin = otherAdmins.length === 0;

      if (isSoleAdmin) {
        const otherMembers = members.filter((m) => m.user_id !== requesterId);
        if (otherMembers.length === 0) {
          throw badRequest(
            "You are the only member. Delete the group instead.",
            "sole_member_cannot_leave",
          );
        }
        if (!newAdminUserId) {
          throw badRequest(
            "You must choose a new admin before leaving.",
            "admin_transfer_required",
          );
        }
        if (newAdminUserId === requesterId) {
          throw badRequest("New admin must be a different member.", "invalid_transfer_target");
        }
        const targetIsMember = await groupsRepository.isUserMember(groupId, newAdminUserId);
        if (!targetIsMember) {
          throw badRequest("The chosen user is not a member of this group.", "transfer_target_not_member");
        }

        const transferred = await groupsRepository.transferAdmin(groupId, requesterId, newAdminUserId);
        if (!transferred) {
          throw badRequest("Failed to transfer admin role.", "admin_transfer_failed");
        }
        didTransfer = true;
        newAdminName = members.find((m) => m.user_id === newAdminUserId)?.name ?? "a member";
      }
    }

    await groupsRepository.removeMember(groupId, requesterId);
    await groupsRepository.updateInvitationStatusByMembership(groupId, requesterId, "left");

    const remainingMembers = members.filter((m) => m.user_id !== requesterId);

    broadcastGroupChange(groupId);
    for (const member of remainingMembers) {
      broadcastInvitationChange(member.user_id);
    }

    void (async () => {
      try {
        await Promise.all(
          remainingMembers.map((member) =>
            groupsRepository.createNotification({
              userId: member.user_id,
              actorUserId: requesterId,
              groupId,
              type: "member_left",
              title: `${requesterName} left`,
              message: `${requesterName} left the group "${groupName}".`,
            }),
          ),
        );

        if (didTransfer && newAdminUserId) {
          await Promise.all(
            remainingMembers.map((member) =>
              groupsRepository.createNotification({
                userId: member.user_id,
                actorUserId: requesterId,
                groupId,
                type: "admin_transferred",
                title: member.user_id === newAdminUserId
                  ? `You are now admin of ${groupName}`
                  : `${newAdminName} is now admin`,
                message: member.user_id === newAdminUserId
                  ? `${requesterName} made you the admin of "${groupName}" before leaving.`
                  : `${requesterName} transferred admin to ${newAdminName} in "${groupName}".`,
              }),
            ),
          );
        }
      } catch {
        // Notification creation is best-effort; the member was already removed.
      }
    })();
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

  async clearNotifications(
    userId: number,
    category?: "invitations" | "activity",
  ): Promise<void> {
    await groupsRepository.clearNotifications(userId, category);
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

    const membersBefore = await groupsRepository.listMembers(group.group_id);
    const inserted = await groupsRepository.addMember(group.group_id, userId);
    const wasNewMember = inserted !== null;

    broadcastGroupChange(group.group_id);
    for (const member of membersBefore) {
      broadcastInvitationChange(member.user_id);
    }

    if (wasNewMember) {
      const joiner = await requireActiveUser(userId);
      const allMembers = [...membersBefore, { name: joiner.name, email: joiner.email }];
      const joinerLabel = displayName(joiner, allMembers);
      void (async () => {
        try {
          await Promise.all(
            membersBefore.map((member) =>
              groupsRepository.createNotification({
                userId: member.user_id,
                actorUserId: userId,
                groupId: group.group_id,
                type: "member_joined",
                title: `${joinerLabel} joined`,
                message: `${joinerLabel} joined "${group.name}" via invite link.`,
              }),
            ),
          );
        } catch {
          // Best-effort notification creation
        }
      })();
    }

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

    const membersBefore = await groupsRepository.listMembers(normalized.group_id);
    const inserted = await groupsRepository.addMember(normalized.group_id, userId);
    const wasNewMember = inserted !== null;

    await groupsRepository.updateInvitationStatus(normalized.invitation_id, "accepted", userId);

    broadcastGroupChange(normalized.group_id);
    broadcastInvitationChange(userId);
    for (const member of membersBefore) {
      broadcastInvitationChange(member.user_id);
    }

    const allMembers = [...membersBefore, { name: userName, email: userEmail }];
    const joinerLabel = displayName({ name: userName, email: userEmail }, allMembers);

    void (async () => {
      try {
        await groupsRepository.createNotification({
          userId: normalized.inviter_user_id,
          actorUserId: userId,
          groupId: normalized.group_id,
          invitationId: normalized.invitation_id,
          type: "group_invitation_accepted",
          title: `${joinerLabel} accepted your invite`,
          message: `${joinerLabel} joined ${normalized.group_name}.`,
        });

        if (wasNewMember) {
          const otherMembers = membersBefore.filter(
            (m) => m.user_id !== normalized.inviter_user_id,
          );
          await Promise.all(
            otherMembers.map((member) =>
              groupsRepository.createNotification({
                userId: member.user_id,
                actorUserId: userId,
                groupId: normalized.group_id,
                type: "member_joined",
                title: `${joinerLabel} joined`,
                message: `${joinerLabel} joined "${normalized.group_name}".`,
              }),
            ),
          );
        }
      } catch {
        // Best-effort notification creation
      }
    })();

    const group = await buildPublicGroup(normalized.group_id, userId);
    return { group, wasNewMember };
  },
};
