import { apiClient } from "@/lib/api-client";
import type { GroupResponse, GroupsResponse, InvitationsResponse, InviteLinkResponse } from "./types";

export const groupsApi = {
  list: () => apiClient.get<GroupsResponse>("/api/groups"),
  getById: (id: string) => apiClient.get<GroupResponse>(`/api/groups/${id}`),
  create: (input: { name: string; description?: string; currency: string }) =>
    apiClient.post<GroupResponse>("/api/groups", input),
  update: (id: string, input: { name: string; description?: string; currency: string }) =>
    apiClient.put<GroupResponse>(`/api/groups/${id}`, input),
  remove: (id: string) => apiClient.delete<void>(`/api/groups/${id}`),
  join: (id: string, input: { userId?: number; userName?: string }) =>
    apiClient.post<void>(`/api/groups/${id}/join`, input),

  // Invitation APIs
  inviteByEmail: (id: string, email: string) =>
    apiClient.post<{ invitation: any }>(`/api/groups/${id}/invite`, { email }),
  listInvitations: (id: string) => apiClient.get<InvitationsResponse>(`/api/groups/${id}/invitations`),
  getInviteLink: (id: string) => apiClient.get<InviteLinkResponse>(`/api/groups/${id}/invite-link`),
  regenerateInviteLink: (id: string) => apiClient.post<InviteLinkResponse>(`/api/groups/${id}/regenerate-link`),

  // Public APIs (no auth required)
  acceptInvitation: (token: string) => apiClient.post<GroupResponse>("/api/groups/accept-invitation", { token }),
  joinViaPublicLink: (token: string) => apiClient.get<GroupResponse>(`/api/groups/join/${token}`),
};
