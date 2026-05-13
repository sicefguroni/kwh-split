import { type GroupExpense, type GroupMember } from "@/hooks/use-groups";

export type { GroupExpense, GroupMember };

export type SplitType = "equal" | "percentage" | "shares" | "exact" | "itemized";

export type Category = "Accommodation" | "Activities" | "Food" | "Groceries" | "General" | "Rent" | "School Requirements" | "Subscriptions" | "Transportation" | "Travel" | "Utilities" | "Other";

export type MemberDiscountType = "none" | "pwd" | "senior";

export interface MemberSplitInput {
  selected: boolean;
  amount: string;
  locked?: boolean;
  discountType?: MemberDiscountType;
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
