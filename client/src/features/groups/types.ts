export interface ApiGroupMember {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  isActive: boolean;
  discountType: string;
}

export interface ApiGroup {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  imageUrl: string | null;
  memberCount: number;
  role: string;
  members: ApiGroupMember[];
  createdAt: string;
  inviteToken: string;
}

export interface ApiGroupInvitation {
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
  status: "pending" | "accepted" | "declined" | "expired" | "left";
  createdAt: string;
  expiresAt: string;
}

export interface ApiInvitationBatchResult {
  created: Array<
    ApiGroupInvitation & {
      deliveryStatus: "sent" | "skipped" | "failed";
    }
  >;
  skipped: Array<{
    identifier: string;
    reason: string;
  }>;
}

export interface ApiInvitePreview {
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

export interface ApiCollaboratorSuggestion {
  userId: string;
  name: string;
  email: string;
  mutualGroups: number;
}

export interface ApiNotification {
  id: string;
  type: "group_invitation_accepted" | "group_invitation_declined" | "group_deleted" | "member_left" | "admin_transferred" | "member_joined" | "expense_added" | "expense_deleted" | "settlement_paid";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  groupId: string | null;
  invitationId: string | null;
}

export interface GroupsResponse {
  groups: ApiGroup[];
}

export interface GroupResponse {
  group: ApiGroup;
}

export interface InvitationsResponse {
  invitations: ApiGroupInvitation[];
}

export type InvitationBatchResponse = ApiInvitationBatchResult;

export interface InviteLinkResponse {
  inviteToken: string | null;
}

export interface InvitePreviewResponse {
  invite: ApiInvitePreview;
}

export interface CollaboratorSuggestionsResponse {
  collaborators: ApiCollaboratorSuggestion[];
}

export interface JoinGroupResponse {
  group: ApiGroup;
  wasNewMember: boolean;
}

export interface NotificationsResponse {
  notifications: ApiNotification[];
}
