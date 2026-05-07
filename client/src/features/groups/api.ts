import { apiClient } from "@/lib/api-client";
import type { GroupResponse, GroupsResponse } from "./types";

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
};
