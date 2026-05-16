import { apiClient } from "@/lib/api-client";
import { ensureSessionRefreshed } from "@/lib/session-refresh";
import type { AuthResponse, AuthUser, MemberSettlementProfileResponse } from "./types";
import type { LoginFormValues, SignupFormValues } from "./schemas";

export interface UpdateProfileInput {
  name?: string;
  profileImageUrl?: string | null;
  bankQrUrl?: string | null;
  discountType?: string;
}

export const authApi = {
  signup: (values: SignupFormValues) =>
    apiClient.post<AuthResponse>("/api/auth/signup", {
      name: values.name,
      email: values.email,
      password: values.password,
      confirmPassword: values.confirmPassword,
    }),

  login: (values: LoginFormValues) =>
    apiClient.post<AuthResponse>("/api/auth/login", {
      email: values.email,
      password: values.password,
    }),

  logout: () => apiClient.post<void>("/api/auth/logout"),

  refreshSession: () => ensureSessionRefreshed(),

  me: (signal?: AbortSignal) =>
    apiClient.get<{ user: AuthUser }>(
      "/api/auth/me",
      signal ? { signal } : undefined,
    ),

  getMemberSettlementProfile: (
    groupId: string,
    userId: string,
    signal?: AbortSignal,
  ) =>
    apiClient.get<MemberSettlementProfileResponse>(
      `/api/auth/groups/${groupId}/members/${userId}/settlement-profile`,
      signal ? { signal } : undefined,
    ),

  updateProfile: (data: UpdateProfileInput) =>
    apiClient.patch<{ user: AuthUser }>("/api/auth/profile", data),
};
