import { groupsRepository, type GroupInvitationWithContextRecord, type GroupNotificationRecord } from "./groups.repository.js";
import type { PublicGroup, PublicGroupInvitation, PublicNotification } from "./groups.public-types.js";

export const toPublicGroup = (
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

export function membersToPublicRoles(
  members: Array<{
    user_id: number;
    name: string;
    email: string;
    role: string;
    is_active: boolean;
    discount_type?: string | null;
  }>,
): PublicGroup["members"] {
  return members.map((member) => ({
    id: String(member.user_id),
    name: member.name,
    email: member.email,
    isAdmin: member.role === "admin",
    isActive: member.is_active,
    discountType: member.discount_type ?? "none",
  }));
}

export const toPublicInvitation = (
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

export const toPublicNotification = (notification: GroupNotificationRecord): PublicNotification => ({
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

export async function markExpiredIfNeeded(
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
