import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import { bankAccountsApi } from "./api";
import type { BankAccount } from "./types";

const bankAccountsKey = (userId?: string) =>
  userId ? ["bank-accounts", userId] : ["bank-accounts", "me"];

export function useOwnBankAccounts() {
  return useQuery<BankAccount[], ApiError>({
    queryKey: bankAccountsKey(),
    queryFn: async () => {
      const { accounts } = await bankAccountsApi.listOwn();
      return accounts;
    },
  });
}

export function useUserBankAccounts(userId: string) {
  return useQuery<BankAccount[], ApiError>({
    queryKey: bankAccountsKey(userId),
    queryFn: async () => {
      const { accounts } = await bankAccountsApi.listForUser(userId);
      return accounts;
    },
    enabled: userId.length > 0,
  });
}

export function useAddBankAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation<BankAccount, ApiError, { bankName: string; accountNumber: string }>({
    mutationFn: async (input) => {
      const { account } = await bankAccountsApi.create(input);
      return account;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bankAccountsKey() });
    },
  });
}

export function useDeleteBankAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (accountId) => bankAccountsApi.remove(accountId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bankAccountsKey() });
    },
  });
}
