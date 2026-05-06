import { type GroupExpense, type GroupMember, type MemberSplitInput, type SplitResult, type SplitType } from "./types";

// =============================================================================
// Date / ID helpers
// =============================================================================

export function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function generateExpenseId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `expense-${crypto.randomUUID()}`;
  }
  return `expense-${Date.now().toString(36)}`;
}

// =============================================================================
// Split input initialisation
// =============================================================================

export function buildDefaultSplitInputs(
  members: GroupMember[],
  initialData?: GroupExpense,
): Record<string, MemberSplitInput> {
  return members.reduce<Record<string, MemberSplitInput>>((acc, member) => {
    const existingSplit = initialData?.splits.find((s: { memberId: string; amount: number }) => s.memberId === member.id);
    acc[member.id] = {
      selected: existingSplit ? existingSplit.amount > 0 : true,
      amount: existingSplit ? existingSplit.amount.toString() : "",
    };
    return acc;
  }, {});
}

// =============================================================================
// Split calculation (pure — no side effects, no React)
// =============================================================================

export function calculateSplits(
  splitType: SplitType,
  totalAmount: number,
  selectedMemberIds: string[],
  memberSplitInputs: Record<string, MemberSplitInput>,
): SplitResult {
  switch (splitType) {
    case "equal": {
      const amount = totalAmount / selectedMemberIds.length;
      return {
        ok: true,
        splits: selectedMemberIds.map((memberId) => ({ memberId, amount })),
      };
    }

    case "percentage": {
      const totalPercent = selectedMemberIds.reduce(
        (sum, id) => sum + (parseFloat(memberSplitInputs[id]?.amount ?? "") || 0),
        0,
      );
      if (Math.abs(totalPercent - 100) > 0.01) {
        return { ok: false, error: "Percentages must sum to 100%." };
      }
      return {
        ok: true,
        splits: selectedMemberIds.map((memberId) => {
          const percent = parseFloat(memberSplitInputs[memberId]?.amount ?? "") || 0;
          return { memberId, amount: (percent / 100) * totalAmount };
        }),
      };
    }

    case "shares": {
      // Check that all selected members have an input
      const missingInputs = selectedMemberIds.filter(
        (id) => !memberSplitInputs[id]?.amount || memberSplitInputs[id]?.amount === "",
      );
      if (missingInputs.length > 0) {
        return { ok: false, error: "All members must have an input" };
      }

      const totalShares = selectedMemberIds.reduce(
        (sum, id) => sum + (parseFloat(memberSplitInputs[id]?.amount ?? "") || 0),
        0,
      );
      if (totalShares <= 0) {
        return { ok: false, error: "Total shares must be greater than 0." };
      }
      return {
        ok: true,
        splits: selectedMemberIds.map((memberId) => {
          const shares = parseFloat(memberSplitInputs[memberId]?.amount ?? "") || 0;
          return { memberId, amount: (shares / totalShares) * totalAmount };
        }),
      };
    }

    case "exact": {
      // Check that all selected members have an input
      const missingInputs = selectedMemberIds.filter(
        (id) => !memberSplitInputs[id]?.amount || memberSplitInputs[id]?.amount === "",
      );
      if (missingInputs.length > 0) {
        return { ok: false, error: "All members must have an input" };
      }

      // Check that exact amounts sum to total
      const exactTotal = selectedMemberIds.reduce(
        (sum, id) => sum + (parseFloat(memberSplitInputs[id]?.amount ?? "") || 0),
        0,
      );
      if (Math.abs(exactTotal - totalAmount) > 0.01) {
        return {
          ok: false,
          error: `Exact amounts must sum to ${totalAmount.toFixed(2)} (current: ${exactTotal.toFixed(2)})`
        };
      }

      return {
        ok: true,
        splits: selectedMemberIds.map((memberId) => ({
          memberId,
          amount: parseFloat(memberSplitInputs[memberId]?.amount ?? "") || 0,
        })),
      };
    }
  }
}

// =============================================================================
// Rounding correction
// =============================================================================

/**
 * Floors all amounts to 2 decimal places, then adds any lost cents
 * to the first entry so the total always matches exactly.
 */
export function applyRoundingCorrection(
  splits: { memberId: string; amount: number }[],
  totalAmount: number,
): { memberId: string; amount: number }[] {
  const floored = splits.map((entry) => ({
    ...entry,
    amount: Math.floor(entry.amount * 100) / 100,
  }));

  const flooredSum = floored.reduce((acc, e) => acc + e.amount, 0);
  const remainder = Math.round((totalAmount - flooredSum) * 100) / 100;

  if (floored.length > 0 && remainder !== 0) {
    floored[0]!.amount = Math.round((floored[0]!.amount + remainder) * 100) / 100;
  }

  return floored;
}
