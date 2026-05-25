import { apiClient } from "@/lib/api-client";
import type {
  SettlementDashboardResponse,
  SettlementHistoryResponse,
  SettlementPlanResponse,
} from "./types";

export const settlementsApi = {
  dashboard: (groupId: string) =>
    apiClient.get<SettlementDashboardResponse>(`/api/settlements/${groupId}`),
  plan: (groupId: string) =>
    apiClient.get<SettlementPlanResponse>(`/api/settlements/${groupId}/plan`),
  history: (groupId: string) =>
    apiClient.get<SettlementHistoryResponse>(`/api/settlements/${groupId}/history`),
  markPaid: (
    groupId: string,
    input: {
      fromUserId: number;
      toUserId: number;
      amount: number;
      note?: string;
      reference?: string;
      paidAt?: string;
    },
  ) => apiClient.post<void>(`/api/settlements/${groupId}/mark-paid`, input),
};
