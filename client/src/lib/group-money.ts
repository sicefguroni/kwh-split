import type { GroupData, GroupExpense } from "@/hooks/use-groups";

/** Sum of expense amounts (group spending total). */
export function totalSpent(expenses: GroupExpense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

/**
 * Net for one member: amount paid by them minus their share across splits.
 * Positive ≈ others owe you; negative ≈ you owe others (simplified ledger).
 */
export function netForMember(expenses: GroupExpense[], memberId: string): number {
  return expenses.reduce((sum, e) => {
    const share = e.splits.find((s) => s.memberId === memberId)?.amount ?? 0;
    const paid = e.paidBy === memberId ? e.amount : 0;
    return sum + (paid - share);
  }, 0);
}

/**
 * Map logged-in user to a group member id (local heuristic until accounts link to members).
 * Prefer first-name match, else first admin, else first member.
 */
export function resolveViewerMemberId(
  group: GroupData,
  userFullName: string | undefined,
  userId?: string,
): string | undefined {
  if (userId) {
    const byId = group.members.find((m) => m.id === userId);
    if (byId) return byId.id;
  }
  const first = userFullName?.trim().split(/\s+/)[0];
  if (first) {
    const byName = group.members.find((m) => m.name.trim().toLowerCase() === first.toLowerCase());
    if (byName) return byName.id;
  }
  const admin = group.members.find((m) => m.isAdmin);
  return admin?.id ?? group.members[0]?.id;
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

/**
 * Pairwise net between viewer and another member: positive means `memberId` owes `viewerId`.
 * Uses expenses where one of the two paid (splits from your app). Other payers are skipped for this pair.
 */
export function netMemberOwesViewer(
  expenses: GroupExpense[],
  viewerId: string,
  memberId: string,
): number {
  if (memberId === viewerId) return 0;
  let net = 0;
  for (const e of expenses) {
    const vShare = e.splits.find((s) => s.memberId === viewerId)?.amount ?? 0;
    const mShare = e.splits.find((s) => s.memberId === memberId)?.amount ?? 0;
    if (e.paidBy === viewerId) net += mShare;
    else if (e.paidBy === memberId) net -= vShare;
  }
  return net;
}

export function totalSpentAcrossGroups(groups: GroupData[]): number {
  return groups.reduce((sum, g) => sum + totalSpent(readGroupExpensesFromStorage(g.id)), 0);
}
