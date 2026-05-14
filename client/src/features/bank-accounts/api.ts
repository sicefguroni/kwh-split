import { apiClient } from "@/lib/api-client";
import type { BankAccountResponse, BankAccountsResponse } from "./types";

export const bankAccountsApi = {
  listOwn: () => apiClient.get<BankAccountsResponse>("/api/bank-accounts/me"),

  listForUser: (userId: string) =>
    apiClient.get<BankAccountsResponse>(`/api/bank-accounts/user/${userId}`),

  create: (input: { bankName: string; accountNumber: string }) =>
    apiClient.post<BankAccountResponse>("/api/bank-accounts/me", input),

  remove: (accountId: string) =>
    apiClient.delete<void>(`/api/bank-accounts/me/${accountId}`),
};
