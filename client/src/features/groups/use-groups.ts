import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import { groupsApi } from "./api";
import type { ApiGroup, ApiGroupInvitation, ApiNotification } from "./types";

const GROUPS_KEY = ["groups"] as const;
const INCOMING_INVITATIONS_KEY = ["incoming-invitations"] as const;
const NOTIFICATIONS_KEY = ["notifications"] as const;

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

export function useIncomingInvitationsQuery() {
  return useQuery<ApiGroupInvitation[], ApiError>({
    queryKey: INCOMING_INVITATIONS_KEY,
    queryFn: async () => {
      const { invitations } = await groupsApi.listIncomingInvitations();
      return invitations;
    },
  });
}

export function useNotificationsQuery() {
  return useQuery<ApiNotification[], ApiError>({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: async () => {
      const { notifications } = await groupsApi.listNotifications();
      return notifications;
    },
  });
}

export function useCreateGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation<ApiGroup, ApiError, { name: string; description?: string | undefined; currency: string; imageUrl?: string | undefined }>({
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
  return useMutation<
    ApiGroup,
    ApiError,
    { id: string; name: string; description?: string | undefined; currency: string; imageUrl?: string | undefined }
  >({
    mutationFn: async (input) => {
      const { group } = await groupsApi.update(input.id, {
        name: input.name,
        description: input.description,
        currency: input.currency,
        imageUrl: input.imageUrl,
      });
      return group;
    },
    onSuccess: (_group, variables) => {
      void queryClient.invalidateQueries({ queryKey: GROUPS_KEY });
      void queryClient.invalidateQueries({ queryKey: [...GROUPS_KEY, variables.id] });
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
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: GROUPS_KEY });
      void queryClient.invalidateQueries({ queryKey: [...GROUPS_KEY, variables.id] });
      void queryClient.invalidateQueries({ queryKey: ["group-invitations", variables.id] });
    },
  });
}

export function useAcceptIncomingInvitationMutation() {
  const queryClient = useQueryClient();
  return useMutation<ApiGroup, ApiError, { invitationId: string }>({
    mutationFn: async ({ invitationId }) => {
      const { group } = await groupsApi.acceptIncomingInvitation(invitationId);
      return group;
    },
    onSuccess: (group) => {
      void queryClient.invalidateQueries({ queryKey: GROUPS_KEY });
      void queryClient.invalidateQueries({ queryKey: [...GROUPS_KEY, group.id] });
      void queryClient.invalidateQueries({ queryKey: INCOMING_INVITATIONS_KEY });
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

export function useDeclineIncomingInvitationMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, { invitationId: string }>({
    mutationFn: async ({ invitationId }) => {
      await groupsApi.declineIncomingInvitation(invitationId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INCOMING_INVITATIONS_KEY });
      void queryClient.invalidateQueries({ queryKey: GROUPS_KEY });
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

export function useMarkNotificationsReadMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError>({
    mutationFn: async () => {
      await groupsApi.markNotificationsRead();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}
