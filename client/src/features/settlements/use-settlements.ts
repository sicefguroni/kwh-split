import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import { settlementsApi } from "./api";
import type { SettlementDashboardEntry, SettlementHistoryEntry, SettlementPlanEntry } from "./types";

const settlementsKey = (groupId: string) => ["settlements", groupId] as const;

export function useSettlementDashboardQuery(groupId: string) {
  return useQuery<SettlementDashboardEntry[], ApiError>({
    queryKey: [...settlementsKey(groupId), "dashboard"],
    queryFn: async () => {
      const { dashboard } = await settlementsApi.dashboard(groupId);
      return dashboard;
    },
    enabled: groupId.length > 0,
  });
}

export function useSettlementPlanQuery(groupId: string) {
  return useQuery<SettlementPlanEntry[], ApiError>({
    queryKey: [...settlementsKey(groupId), "plan"],
    queryFn: async () => {
      const { plan } = await settlementsApi.plan(groupId);
      return plan;
    },
    enabled: groupId.length > 0,
  });
}

export function useSettlementHistoryQuery(groupId: string) {
  return useQuery<SettlementHistoryEntry[], ApiError>({
    queryKey: [...settlementsKey(groupId), "history"],
    queryFn: async () => {
      const { history } = await settlementsApi.history(groupId);
      return history;
    },
    enabled: groupId.length > 0,
  });
}

export function useMarkSettlementPaidMutation(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    void,
    ApiError,
    {
      fromUserId: number;
      toUserId: number;
      amount: number;
      note?: string;
      reference?: string;
      paidAt?: string;
    }
  >({
    mutationFn: (input) => settlementsApi.markPaid(groupId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...settlementsKey(groupId), "dashboard"] });
      void queryClient.invalidateQueries({ queryKey: [...settlementsKey(groupId), "plan"] });
      void queryClient.invalidateQueries({ queryKey: [...settlementsKey(groupId), "history"] });
      void queryClient.invalidateQueries({ queryKey: ["expenses", groupId] });
    },
  });
}
