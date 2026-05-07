import { apiClient } from "@/lib/api-client";
import type { ExpensesResponse } from "./types";

export interface ExpenseWritePayload {
  groupId: number;
  titleDescription: string;
  totalAmount: number;
  paidByUserId?: number;
  saleDate: string;
  taxAmount?: number;
  tipAmount?: number;
  splitType: "equal" | "percentage" | "shares" | "exact" | "itemized";
  participantUserIds?: number[];
  splits?: Array<{ userId: number; percentage?: number; share?: number; amount?: number }>;
  memberDiscounts?: Array<{ userId: number; type: "none" | "pwd" | "senior" }>;
}

export const expensesApi = {
  listByGroup: (groupId: string) => apiClient.get<ExpensesResponse>(`/api/expenses/${groupId}`),
  create: (payload: ExpenseWritePayload) => apiClient.post<{ expenseId: string }>("/api/expenses", payload),
  update: (expenseId: string, payload: ExpenseWritePayload) =>
    apiClient.put<void>(`/api/expenses/${expenseId}`, payload),
  remove: (expenseId: string) => apiClient.delete<void>(`/api/expenses/${expenseId}`),
};
