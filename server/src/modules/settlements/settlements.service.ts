import { badRequest } from "../../utils/errors.js";
import { assertGroupMember } from "../common/authorization.js";
import { broadcastGroupChange, broadcastInvitationChange } from "../realtime/realtime-hub.js";
import { groupsRepository } from "../groups/groups.repository.js";
import { userRepository } from "../auth/auth.repository.js";
import { displayName } from "../../utils/display-name.js";
import { settlementsRepository } from "./settlements.repository.js";
import type { MarkPaidInput } from "./settlements.schemas.js";

export interface SettlementPlanEntry {
  fromUserId: number;
  toUserId: number;
  amount: number;
}

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

/**
 * Compute min-transaction settlement plan using greedy matching.
 * Creditors (net > 0) are matched to debtors (net < 0) such that
 * the number of transactions is minimized.
 *
 * Algorithm:
 * 1. Split members into creditors and debtors by net balance
 * 2. Sort creditors descending (most owed first)
 * 3. Sort debtors ascending (most negative first = owes the most)
 * 4. Greedy match: largest debtor pays largest creditor until one is satisfied
 */
export function computeSettlementPlan(
  netBalances: Array<{ userId: number; netBalance: number }>,
): SettlementPlanEntry[] {
  const creditors = netBalances
    .filter((b) => b.netBalance > 0.005)
    .map((b) => ({ userId: b.userId, remaining: b.netBalance }))
    .sort((a, b) => b.remaining - a.remaining);

  const debtors = netBalances
    .filter((b) => b.netBalance < -0.005)
    .map((b) => ({ userId: b.userId, remaining: -b.netBalance }))
    .sort((a, b) => b.remaining - a.remaining);

  const plan: SettlementPlanEntry[] = [];

  let di = 0;
  let ci = 0;
  while (di < debtors.length && ci < creditors.length) {
    const debtor = debtors[di]!;
    const creditor = creditors[ci]!;
    const amount = Math.min(debtor.remaining, creditor.remaining);

    plan.push({
      fromUserId: debtor.userId,
      toUserId: creditor.userId,
      amount: Math.round(amount * 100) / 100,
    });

    debtor.remaining -= amount;
    creditor.remaining -= amount;

    if (debtor.remaining < 0.005) di++;
    if (creditor.remaining < 0.005) ci++;
  }

  return plan;
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

    if (requesterId !== input.toUserId) {
      throw badRequest(
        "Only the person owed can record a settlement",
        "invalid_settlement",
      );
    }

    const balances = await settlementsRepository.getNetBalances(groupId);
    const fromBalance = balances.find((b) => b.userId === input.fromUserId);
    const toBalance = balances.find((b) => b.userId === input.toUserId);

    if (!fromBalance || fromBalance.netBalance >= -0.005) {
      throw badRequest(
        "Payer does not have an outstanding balance to settle",
        "invalid_settlement",
      );
    }

    if (!toBalance || toBalance.netBalance <= 0.005) {
      throw badRequest(
        "Recipient is not owed any outstanding amount",
        "invalid_settlement",
      );
    }

    const totalDebt = -fromBalance.netBalance;
    const totalCredit = toBalance.netBalance;
    const maxPayable = Math.min(totalDebt, totalCredit);

    if (input.amount > maxPayable + 0.005) {
      throw badRequest(
        `Settlement amount exceeds the maximum payable (${maxPayable.toFixed(2)}). You can only settle what you actually owe to this member.`,
        "invalid_settlement",
      );
    }

    const result = await settlementsRepository.markPaidAndSettleSplits(groupId, input);
    broadcastGroupChange(groupId);

    void (async () => {
      try {
        const [members, user, group] = await Promise.all([
          groupsRepository.listMembers(groupId),
          userRepository.findById(requesterId),
          groupsRepository.findById(groupId),
        ]);
        if (!user || !group) return;
        const userName = displayName(user, members);

        if (result.expenseTitles.length > 0) {
          for (const expenseTitle of result.expenseTitles) {
            await groupsRepository.createNotification({
              groupId,
              userId: input.fromUserId,
              type: "settlement_paid",
              title: "Settlement received",
              message: `${userName} settled a payment for ${expenseTitle} in ${group.name}.`,
            });
          }
        } else {
          const amount = `${group.currency} ${Number(input.amount).toFixed(2)}`;
          await groupsRepository.createNotification({
            groupId,
            userId: input.fromUserId,
            type: "settlement_paid",
            title: "Settlement received",
            message: `${userName} settled ${amount} in ${group.name}.`,
          });
        }
        broadcastInvitationChange(input.fromUserId);
      } catch { /* fire-and-forget */ }
    })();
  },

  async getPlan(groupId: number, requesterId: number): Promise<SettlementPlanEntry[]> {
    await assertGroupMember(requesterId, groupId);
    const balances = await settlementsRepository.getNetBalances(groupId);
    return computeSettlementPlan(
      balances.map((b) => ({ userId: b.userId, netBalance: b.netBalance })),
    );
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
