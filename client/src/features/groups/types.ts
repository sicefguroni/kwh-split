export interface ApiGroupMember {
  id: string;
  name: string;
  isAdmin: boolean;
}

export interface ApiGroup {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  memberCount: number;
  role: string;
  members: ApiGroupMember[];
  createdAt: string;
  inviteToken: string;
}

export interface ApiGroupInvitation {
  id: string;
  groupId: string;
  inviterName: string;
  inviteeEmail: string;
  inviteeName: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
  expiresAt: string;
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

export interface InviteLinkResponse {
  inviteToken: string;
}
