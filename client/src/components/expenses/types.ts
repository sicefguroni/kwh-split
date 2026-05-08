import { type GroupExpense, type GroupMember } from "@/hooks/use-groups";

export type { GroupExpense, GroupMember };

export type SplitType = "equal" | "percentage" | "shares" | "exact";

export interface MemberSplitInput {
  selected: boolean;
  amount: string;
}

export type SplitResult =
  | { ok: true; splits: { memberId: string; amount: number }[] }
  | { ok: false; error: string };

export interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (expense: GroupExpense) => void;
  initialData: GroupExpense | undefined;
  members: GroupMember[];
  currency: string;
  groupName: string;
}
