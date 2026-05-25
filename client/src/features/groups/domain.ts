/**
 * Client-side domain shapes for expenses and groups in the SPA.
 * (Kept separate from API DTOs in types.ts.)
 */

export interface GroupMember {
  id: string;
  name: string;
  email?: string;
  isAdmin: boolean;
  isActive: boolean;
  discountType?: string;
}

export interface GroupExpenseSplit {
  memberId: string;
  amount: number;
  originalAmount?: number | undefined;
  percentage?: number;
  share?: number;
  isSettled?: boolean;
}

export interface GroupExpenseItem {
  id: string;
  itemName: string;
  price: number;
  assignedUserIds: string[];
}

export interface PayerEntry {
  userId: string;
  amountPaid: number;
}

export interface GroupExpense {
  id: string;
  name: string;
  amount: number;
  currency: string;
  paidBy: string;
  payerAmounts?: PayerEntry[];
  date: string;
  note?: string;
  category?: string;
  splitType?: "equal" | "percentage" | "shares" | "exact" | "itemized";
  splits: GroupExpenseSplit[];
  receiptItems?: GroupExpenseItem[];
  memberDiscounts?: Array<{ memberId: string; type: "none" | "pwd" | "senior" }>;
  status: "pending" | "synced";
}

export interface GroupData {
  id: string;
  name: string;
  description: string;
  currency: string;
  imageUrl?: string | undefined;
  members: GroupMember[];
  balance: number;
  createdAt: string;
  role?: string | undefined;
}
