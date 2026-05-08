export interface SettlementDashboardEntry {
  userId: string;
  outstandingAmount: number;
  paidAmount: number;
}

export interface SettlementHistoryEntry {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amountPaid: number;
  note: string | null;
  reference: string | null;
  paidAt: string;
  createdAt: string;
}

export interface SettlementDashboardResponse {
  dashboard: SettlementDashboardEntry[];
}

export interface SettlementHistoryResponse {
  history: SettlementHistoryEntry[];
}
