import { badRequest } from "../../utils/errors.js";
import { env } from "../../config/env.js";
import { hashPassword } from "../../utils/password.js";
import { randomUUID } from "node:crypto";
import { groupsRepository } from "./groups.repository.js";
import type { CreateGroupInput, JoinGroupInput, UpdateGroupInput } from "./groups.schemas.js";

export interface PublicGroup {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  memberCount: number;
  role: string;
  members: Array<{ id: string; name: string; isAdmin: boolean }>;
  createdAt: string;
}

const toPublicGroup = (
  record: {
    group_id: number;
    name: string;
    description: string | null;
    currency: string;
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
};
