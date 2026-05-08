import { badRequest } from "../../utils/errors.js";
import { env } from "../../config/env.js";
import { hashPassword } from "../../utils/password.js";
import { randomUUID } from "node:crypto";
import { groupsRepository } from "./groups.repository.js";
import type { CreateGroupInput, JoinGroupInput, UpdateGroupInput } from "./groups.schemas.js";
export interface PublicGroupInvitation {
  id: string;
  groupId: string;
  inviterName: string;
  inviteeEmail: string;
  inviteeName: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
  expiresAt: string;
}
export interface PublicGroup {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  memberCount: number;
  role: string;
  members: Array<{ id: string; name: string; isAdmin: boolean }>;
  createdAt: string;
  inviteToken: string;
}

const toPublicGroup = (
  record: {
    group_id: number;
    name: string;
    description: string | null;
    currency: string;
    invite_token: string | null;
    created_at: Date;
  } & { role: string },
  memberCount: number,
): PublicGroup => ({
  id: String(record.group_id),
  name: record.name,
  description: record.description,
  currency: record.currency,
  memberCount,
  role: record.role,
  members: [],
  createdAt: record.created_at.toISOString(),
  inviteToken: record.invite_token || '',
});

export const groupsService = {
  async create(ownerUserId: number, input: CreateGroupInput): Promise<PublicGroup> {
    const group = await groupsRepository.createGroupWithOwner({
      name: input.name,
      currency: input.currency,
      ownerUserId,
      ...(input.description ? { description: input.description } : {}),
    });
    const members = await groupsRepository.listMembers(group.group_id);
    const publicGroup = toPublicGroup({ ...group, role: "admin" }, members.length);
    return {
      ...publicGroup,
      members: members.map((member) => ({
        id: String(member.user_id),
        name: member.name,
        isAdmin: member.role === "admin",
      })),
    };
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
            isAdmin: member.role === "admin",
          })),
        };
      }),
    );
    return groupsWithMembers;
  },

  async getByIdForUser(groupId: number, userId: number): Promise<PublicGroup> {
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
        isAdmin: member.role === "admin",
      })),
    };
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
        // Dev-only convenience: auto-provision placeholder users by name.
        const passwordHash = await hashPassword(randomUUID());
        const created = await groupsRepository.createActiveUserForTesting(
          input.userName,
          passwordHash,
        );
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
  },

  async update(groupId: number, requesterId: number, input: UpdateGroupInput): Promise<PublicGroup> {
    const updated = await groupsRepository.updateGroup(
      input.description
        ? {
          groupId,
          userId: requesterId,
          name: input.name,
          description: input.description,
          currency: input.currency,
        }
        : {
          groupId,
          userId: requesterId,
          name: input.name,
          currency: input.currency,
        },
    );
    if (!updated) {
      throw badRequest("Only group admin can update this group", "group_admin_required");
    }
    return this.getByIdForUser(groupId, requesterId);
  },

  async remove(groupId: number, requesterId: number): Promise<void> {
    const deleted = await groupsRepository.deleteGroup({ groupId, userId: requesterId });
    if (!deleted) {
      throw badRequest("Only group admin can delete this group", "group_admin_required");
    }
  },

  // Invitation methods
  async inviteByEmail(groupId: number, inviterId: number, inviteeEmail: string): Promise<PublicGroupInvitation> {
    // Check if inviter is a member of the group
    const group = await groupsRepository.findForUser(groupId, inviterId);
    if (!group) {
      throw badRequest("You are not a member of this group", "not_group_member");
    }

    // Check if user is already invited
    const existingInvitation = await groupsRepository.findInvitationByEmailAndGroup(inviteeEmail, groupId);
    if (existingInvitation) {
      throw badRequest("User is already invited to this group", "already_invited");
    }

    // Check if user is already a member
    const existingMember = await groupsRepository.listMembers(groupId);
    const isAlreadyMember = existingMember.some(member => {
      // We can't check email directly from members, need to join with users table
      // For now, we'll check this when accepting the invitation
      return false;
    });

    // Generate invitation token and expiry (7 days from now)
    const inviteToken = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await groupsRepository.createInvitation({
      groupId,
      inviterUserId: inviterId,
      inviteeEmail,
      inviteToken,
      expiresAt,
    });

    // TODO: Send email with invitation link
    // For now, we'll just return the invitation

    return {
      id: String(invitation.invitation_id),
      groupId: String(invitation.group_id),
      inviterName: '', // Will be populated by caller
      inviteeEmail: invitation.invitee_email,
      inviteeName: null,
      status: invitation.status,
      createdAt: invitation.created_at.toISOString(),
      expiresAt: invitation.expires_at.toISOString(),
    };
  },

  async acceptInvitation(inviteToken: string, userId: number): Promise<{ group: PublicGroup; wasNewMember: boolean }> {
    const invitation = await groupsRepository.findInvitationByToken(inviteToken);
    if (!invitation) {
      throw badRequest("Invalid invitation token", "invalid_invitation");
    }

    if (invitation.status !== 'pending') {
      throw badRequest("Invitation has already been processed", "invitation_processed");
    }

    if (invitation.expires_at < new Date()) {
      await groupsRepository.updateInvitationStatus(invitation.invitation_id, 'expired');
      throw badRequest("Invitation has expired", "invitation_expired");
    }

    // Check if user is already a member
    const existingMember = await groupsRepository.addMember(invitation.group_id, userId);
    const wasNewMember = !!existingMember;

    if (wasNewMember) {
      // Update invitation status
      await groupsRepository.updateInvitationStatus(invitation.invitation_id, 'accepted', userId);
    } else {
      throw badRequest("You are already a member of this group", "already_member");
    }

    // Return the group details
    const group = await this.getByIdForUser(invitation.group_id, userId);
    return { group, wasNewMember };
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
    if (!group || group.role !== 'admin') {
      throw badRequest("Only group admin can regenerate invite link", "group_admin_required");
    }

    const newToken = await groupsRepository.regenerateInviteToken(groupId);
    if (!newToken) {
      throw badRequest("Failed to regenerate invite link", "regenerate_failed");
    }

    return newToken;
  },

  async joinViaPublicLink(inviteToken: string, userId: number): Promise<{ group: PublicGroup; wasNewMember: boolean }> {
    const group = await groupsRepository.findGroupByInviteToken(inviteToken);
    if (!group) {
      throw badRequest("Invalid invite link", "invalid_invite_link");
    }

    // Check if user is already a member
    const existingMember = await groupsRepository.addMember(group.group_id, userId);
    const wasNewMember = !!existingMember;

    if (!wasNewMember) {
      throw badRequest("You are already a member of this group", "already_member");
    }

    // Return the group details
    const fullGroup = await this.getByIdForUser(group.group_id, userId);
    return { group: fullGroup, wasNewMember };
  },

  async listInvitations(groupId: number, userId: number): Promise<PublicGroupInvitation[]> {
    const group = await groupsRepository.findForUser(groupId, userId);
    if (!group) {
      throw badRequest("You are not a member of this group", "not_group_member");
    }

    const invitations = await groupsRepository.listInvitationsForGroup(groupId);
    return invitations.map(inv => ({
      id: String(inv.invitation_id),
      groupId: String(inv.group_id),
      inviterName: inv.inviter_name,
      inviteeEmail: inv.invitee_email,
      inviteeName: inv.invitee_name,
      status: inv.status,
      createdAt: inv.created_at.toISOString(),
      expiresAt: inv.expires_at.toISOString(),
    }));
  },
};
