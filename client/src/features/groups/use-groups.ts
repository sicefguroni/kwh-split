import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import { groupsApi } from "./api";
import type { ApiGroup } from "./types";

const GROUPS_KEY = ["groups"] as const;

export function useGroupsQuery() {
  return useQuery<ApiGroup[], ApiError>({
    queryKey: GROUPS_KEY,
    queryFn: async () => {
      const { groups } = await groupsApi.list();
      return groups;
    },
  });
}

export function useGroupQuery(groupId: string) {
  return useQuery<ApiGroup, ApiError>({
    queryKey: [...GROUPS_KEY, groupId],
    queryFn: async () => {
      const { group } = await groupsApi.getById(groupId);
      return group;
    },
    enabled: groupId.length > 0,
  });
}

export function useCreateGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation<ApiGroup, ApiError, { name: string; description?: string; currency: string }>({
    mutationFn: async (input) => {
      const { group } = await groupsApi.create(input);
      return group;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: GROUPS_KEY });
    },
  });
}

export function useUpdateGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation<ApiGroup, ApiError, { id: string; name: string; description?: string; currency: string }>({
    mutationFn: async (input) => {
      const { group } = await groupsApi.update(
        input.id,
        input.description
          ? {
              name: input.name,
              description: input.description,
              currency: input.currency,
            }
          : {
              name: input.name,
              currency: input.currency,
            },
      );
      return group;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: GROUPS_KEY });
    },
  });
}

export function useDeleteGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, { id: string }>({
    mutationFn: async ({ id }) => {
      await groupsApi.remove(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: GROUPS_KEY });
    },
  });
}

export function useJoinGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, { id: string; userId?: number; userName?: string }>({
    mutationFn: async (input) => {
      const payload =
        input.userId !== undefined
          ? { userId: input.userId }
          : input.userName
            ? { userName: input.userName }
            : {};
      await groupsApi.join(input.id, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: GROUPS_KEY });
    },
  });
}
