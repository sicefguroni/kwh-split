import { apiClient } from "@/lib/api-client";
import type {
  SettlementDashboardResponse,
  SettlementHistoryResponse,
} from "./types";

export const settlementsApi = {
  dashboard: (groupId: string) =>
    apiClient.get<SettlementDashboardResponse>(`/api/settlements/${groupId}`),
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
