import type { GroupInviteDeliveryStatus } from "./groups.mailer.js";

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
  members: Array<{ id: string; name: string; email: string; isAdmin: boolean; isActive: boolean; discountType: string }>;
  createdAt: string;
  inviteToken: string;
}

export interface PublicNotification {
  id: string;
  type:
    | "group_invitation_accepted"
    | "group_invitation_declined"
    | "group_deleted"
    | "member_left"
    | "admin_transferred"
    | "member_joined"
    | "expense_added"
    | "expense_deleted"
    | "settlement_paid";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  groupId: string | null;
  invitationId: string | null;
}
