import { badRequest } from "../../utils/errors.js";
import { assertGroupMember } from "../common/authorization.js";
import { settlementsRepository } from "./settlements.repository.js";
import type { MarkPaidInput } from "./settlements.schemas.js";

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

export const settlementsService = {
  async getDashboard(groupId: number, requesterId: number): Promise<SettlementDashboardEntry[]> {
    await assertGroupMember(requesterId, groupId);
    const [outstanding, paid] = await Promise.all([
      settlementsRepository.getOutstandingByUser(groupId),
      settlementsRepository.getPaidByUser(groupId),
    ]);
    const paidMap = new Map(paid.map((row) => [row.user_id, Number(row.paid_amount)]));
    return outstanding.map((row) => ({
      userId: String(row.user_id),
      outstandingAmount: Number(row.outstanding_amount),
      paidAmount: paidMap.get(row.user_id) ?? 0,
    }));
  },

  async markPaid(groupId: number, requesterId: number, input: MarkPaidInput): Promise<void> {
    await assertGroupMember(requesterId, groupId);
    await assertGroupMember(input.fromUserId, groupId);
    await assertGroupMember(input.toUserId, groupId);
    if (input.fromUserId === input.toUserId) {
      throw badRequest("fromUserId and toUserId must be different", "invalid_settlement");
    }
    await settlementsRepository.markPaidAndSettleSplits(groupId, input);
  },

  async history(groupId: number, requesterId: number): Promise<SettlementHistoryEntry[]> {
    await assertGroupMember(requesterId, groupId);
    const rows = await settlementsRepository.listHistory(groupId);
    return rows.map((row) => ({
      id: String(row.settlement_event_id),
      fromUserId: String(row.from_user_id),
      fromUserName: row.from_user_name,
      toUserId: String(row.to_user_id),
      toUserName: row.to_user_name,
      amountPaid: Number(row.amount_paid),
      note: row.note,
      reference: row.reference,
      paidAt: row.paid_at.toISOString(),
      createdAt: row.created_at.toISOString(),
    }));
  },
};
