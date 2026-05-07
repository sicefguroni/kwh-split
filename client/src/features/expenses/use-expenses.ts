import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import { expensesApi, type ExpenseWritePayload } from "./api";
import type { ApiExpense } from "./types";

const expenseKey = (groupId: string) => ["expenses", groupId] as const;

export function useExpensesQuery(groupId: string) {
  return useQuery<ApiExpense[], ApiError>({
    queryKey: expenseKey(groupId),
    queryFn: async () => {
      const { expenses } = await expensesApi.listByGroup(groupId);
      return expenses;
    },
    enabled: groupId.length > 0,
  });
}

export function useCreateExpenseMutation(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation<{ expenseId: string }, ApiError, ExpenseWritePayload>({
    mutationFn: (payload) => expensesApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: expenseKey(groupId) });
    },
  });
}

export function useUpdateExpenseMutation(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, { expenseId: string; payload: ExpenseWritePayload }>({
    mutationFn: ({ expenseId, payload }) => expensesApi.update(expenseId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: expenseKey(groupId) });
    },
  });
}

export function useDeleteExpenseMutation(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, { expenseId: string }>({
    mutationFn: ({ expenseId }) => expensesApi.remove(expenseId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: expenseKey(groupId) });
    },
  });
}
