export interface ApiExpenseSplit {
  id: string;
  userId: string;
  amountOwed: number;
  percentage: number | null;
  share: number | null;
  isSettled: boolean;
}

export interface ApiExpense {
  id: string;
  groupId: string;
  titleDescription: string;
  totalAmount: number;
  paidByUserId: string | null;
  saleDate: string;
  taxAmount: number;
  tipAmount: number;
  splitType: string;
  splits: ApiExpenseSplit[];
  receiptItems: Array<{
    id: string;
    itemName: string;
    price: number;
    assignedUserIds: string[];
  }>;
  memberDiscounts: Array<{
    id: string;
    userId: string;
    type: "pwd" | "senior";
    ratePercent: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface ExpensesResponse {
  expenses: ApiExpense[];
}
