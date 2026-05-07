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
}

export interface GroupsResponse {
  groups: ApiGroup[];
}

export interface GroupResponse {
  group: ApiGroup;
}
