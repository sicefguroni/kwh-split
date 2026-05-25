import type { GroupData, GroupExpense } from "@/features/groups/domain";

/** Sum of expense amounts (group spending total). */
export function totalSpent(expenses: GroupExpense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

/**
 * Net for one member: amount paid by them minus their share across splits.
 * Positive ≈ others owe you; negative ≈ you owe others (simplified ledger).
 * Supports multiple payers via payerAmounts.
 */
export function netForMember(expenses: GroupExpense[], memberId: string): number {
  return expenses.reduce((sum, e) => {
    const share = getOriginalShare(e, memberId);
    const paid = getPaid(e, memberId);
    return sum + (paid - share);
  }, 0);
}

/**
 * Map logged-in user to a group member id (local heuristic until accounts link to members).
 * Prefer first-name match, else first admin, else first member.
 */
export function resolveViewerMemberId(
  group: GroupData,
  _userFullName: string | undefined,
  userId?: string,
): string | undefined {
  if (userId) {
    const byId = group.members.find((m) => m.id === userId);
    if (byId) return byId.id;
    return undefined;
  }
  return group.members.find((m) => m.isAdmin)?.id ?? group.members[0]?.id;
}

export function readGroupExpensesFromStorage(groupId: string): GroupExpense[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`group-expenses-${groupId}`);
    if (!raw) return [];
    return JSON.parse(raw) as GroupExpense[];
  } catch {
    return [];
  }
}

function getOriginalShare(e: GroupExpense, memberId: string): number {
  const split = e.splits.find((s) => s.memberId === memberId);
  if (!split) return 0;
  if (split.originalAmount != null && split.originalAmount > 0) return split.originalAmount;
  if (split.percentage != null) return e.amount * split.percentage / 100;
  if (split.share != null) {
    const totalShares = e.splits.reduce((s, sp) => s + (sp.share ?? 0), 0);
    if (totalShares > 0) return e.amount * split.share / totalShares;
  }
  return e.amount / e.splits.length;
}

function getPaid(e: GroupExpense, memberId: string): number {
  if (e.payerAmounts?.length) {
    const entry = e.payerAmounts.find((p) => p.userId === memberId);
    if (entry) return entry.amountPaid;
  }
  if (e.paidBy === memberId) return e.amount;
  return 0;
}

/**
 * Pairwise net between viewer and another member: positive means `memberId` owes `viewerId`.
 * Uses shortfall-based distribution: overpayer's excess is distributed proportionally
 * to each underpayer's shortfall (not by share), which correctly handles multiple payers.
 */
export function netMemberOwesViewer(
  expenses: GroupExpense[],
  viewerId: string,
  memberId: string,
): number {
  if (memberId === viewerId) return 0;
  let net = 0;
  for (const e of expenses) {
    const vShare = getOriginalShare(e, viewerId);
    const mShare = getOriginalShare(e, memberId);
    const vPaid = getPaid(e, viewerId);
    const mPaid = getPaid(e, memberId);

    const vExcess = Math.max(0, vPaid - vShare);
    const mExcess = Math.max(0, mPaid - mShare);

    const allParties = e.splits.map((s) => ({
      id: s.memberId,
      share: getOriginalShare(e, s.memberId),
      paid: getPaid(e, s.memberId),
    }));

    if (vExcess > 0) {
      let totalShortfall = 0;
      for (const p of allParties) {
        if (p.id !== viewerId) totalShortfall += Math.max(0, p.share - p.paid);
      }
      if (totalShortfall > 0.005) {
        const mShortfall = Math.max(0, mShare - mPaid);
        net += vExcess * mShortfall / totalShortfall;
      }
    }

    if (mExcess > 0) {
      let totalShortfall = 0;
      for (const p of allParties) {
        if (p.id !== memberId) totalShortfall += Math.max(0, p.share - p.paid);
      }
      if (totalShortfall > 0.005) {
        const vShortfall = Math.max(0, vShare - vPaid);
        net -= mExcess * vShortfall / totalShortfall;
      }
    }
  }
  return net;
}

export function totalSpentAcrossGroups(groups: GroupData[]): number {
  return groups.reduce((sum, g) => sum + totalSpent(readGroupExpensesFromStorage(g.id)), 0);
}
