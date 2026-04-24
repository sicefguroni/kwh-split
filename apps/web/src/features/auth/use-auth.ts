import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "./api";
import type { AuthResponse, AuthUser } from "./types";
import type { LoginFormValues, SignupFormValues } from "./schemas";
import { ApiError } from "@/lib/api-client";

const ME_KEY = ["auth", "me"] as const;

export function useCurrentUser() {
  return useQuery<AuthUser | null, ApiError>({
    queryKey: ME_KEY,
    queryFn: async ({ signal }) => {
      try {
        const { user } = await authApi.me(signal);
        return user;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return null;
        }
        throw error;
      }
    },
    staleTime: 60_000,
  });
}

export function useLoginMutation() {
  const queryClient = useQueryClient();
  return useMutation<AuthResponse, ApiError, LoginFormValues>({
    mutationFn: (values) => authApi.login(values),
    onSuccess: ({ user }) => {
      queryClient.setQueryData<AuthUser>(ME_KEY, user);
    },
  });
}

export function useSignupMutation() {
  const queryClient = useQueryClient();
  return useMutation<AuthResponse, ApiError, SignupFormValues>({
    mutationFn: (values) => authApi.signup(values),
    onSuccess: ({ user }) => {
      queryClient.setQueryData<AuthUser>(ME_KEY, user);
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError>({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      queryClient.setQueryData<AuthUser | null>(ME_KEY, null);
      queryClient.clear();
    },
  });
}
