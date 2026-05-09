import { apiClient } from "@/lib/api-client";
import type {
  CollaboratorSuggestionsResponse,
  GroupResponse,
  GroupsResponse,
  InvitationBatchResponse,
  InvitationsResponse,
  InviteLinkResponse,
  InvitePreviewResponse,
  JoinGroupResponse,
  NotificationsResponse,
} from "./types";

export const groupsApi = {
  list: () => apiClient.get<GroupsResponse>("/api/groups"),
  getById: (id: string) => apiClient.get<GroupResponse>(`/api/groups/${id}`),
  create: (input: { name: string; description?: string | undefined; currency: string; imageUrl?: string | undefined }) =>
    apiClient.post<GroupResponse>("/api/groups", input),
  update: (id: string, input: { name: string; description?: string | undefined; currency: string; imageUrl?: string | undefined }) =>
    apiClient.put<GroupResponse>(`/api/groups/${id}`, input),
  remove: (id: string) => apiClient.delete<void>(`/api/groups/${id}`),
  join: (id: string, input: { userId?: number; userName?: string }) =>
    apiClient.post<void>(`/api/groups/${id}/join`, input),

  createInvitations: (
    id: string,
    input: { recipients: Array<{ email?: string; userId?: number }> },
  ) => apiClient.post<InvitationBatchResponse>(`/api/groups/${id}/invite`, input),
  listInvitations: (id: string) => apiClient.get<InvitationsResponse>(`/api/groups/${id}/invitations`),
  listIncomingInvitations: () => apiClient.get<InvitationsResponse>("/api/groups/invitations/incoming"),
  listNotifications: () => apiClient.get<NotificationsResponse>("/api/groups/notifications"),
  markNotificationsRead: () => apiClient.post<void>("/api/groups/notifications/read"),
  acceptIncomingInvitation: (invitationId: string) =>
    apiClient.post<JoinGroupResponse>(`/api/groups/invitations/${invitationId}/accept`),
  declineIncomingInvitation: (invitationId: string) =>
    apiClient.post<void>(`/api/groups/invitations/${invitationId}/decline`),
  getInviteLink: (id: string) => apiClient.get<InviteLinkResponse>(`/api/groups/${id}/invite-link`),
  regenerateInviteLink: (id: string) => apiClient.post<InviteLinkResponse>(`/api/groups/${id}/regenerate-link`),
  searchCollaborators: (query: string, excludeGroupId?: string) => {
    const params = new URLSearchParams({ q: query });
    if (excludeGroupId) {
      params.set("excludeGroupId", excludeGroupId);
    }
    return apiClient.get<CollaboratorSuggestionsResponse>(`/api/groups/collaborators/search?${params.toString()}`);
  },

  previewInviteToken: (token: string) => apiClient.get<InvitePreviewResponse>(`/api/groups/join/${token}`),
  acceptInviteToken: (token: string) => apiClient.post<JoinGroupResponse>(`/api/groups/join/${token}`),
  acceptInvitation: (token: string) => apiClient.post<JoinGroupResponse>("/api/groups/accept-invitation", { token }),
};
