import { type GroupExpense, type GroupMember, type MemberSplitInput, type SplitResult, type SplitType } from "./types";

type LockableMemberSplitInput = MemberSplitInput & { locked?: boolean };

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
  const discountsByMemberId = new Map(
    (initialData?.memberDiscounts ?? []).map((entry) => [entry.memberId, entry.type]),
  );
  return members.reduce<Record<string, MemberSplitInput>>((acc, member) => {
    const existingSplit = initialData?.splits.find((s: { memberId: string; amount: number }) => s.memberId === member.id);
    acc[member.id] = {
      selected: existingSplit ? existingSplit.amount > 0 : true,
      amount: existingSplit ? existingSplit.amount.toString() : "",
      locked: false,
      discountType: discountsByMemberId.get(member.id) ?? "none",
    } as LockableMemberSplitInput;
    return acc;
  }, {});
}

const toCents = (value: number): number => Math.round(value * 100);
const fromCents = (value: number): number => value / 100;

function parseAmount(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseAmountCents(value: string): number {
  return toCents(parseAmount(value));
}

function isLocked(input: MemberSplitInput | undefined): boolean {
  return Boolean((input as LockableMemberSplitInput | undefined)?.locked);
}

function distributeEvenly(totalCents: number, ids: string[]): Map<string, number> {
  const result = new Map<string, number>();
  if (ids.length === 0) return result;
  const base = Math.floor(totalCents / ids.length);
  const remainder = totalCents - base * ids.length;
  ids.forEach((id, index) => {
    result.set(id, base + (index < remainder ? 1 : 0));
  });
  return result;
}

function writeCents(
  next: Record<string, MemberSplitInput>,
  centsById: Map<string, number>,
): Record<string, MemberSplitInput> {
  for (const [id, cents] of centsById.entries()) {
    if (!next[id]) continue;
    next[id] = {
      ...next[id]!,
      amount: fromCents(Math.max(0, cents)).toFixed(2),
    };
  }
  return next;
}

export function validateExactSplitState(
  inputs: Record<string, MemberSplitInput>,
  selectedIds: string[],
  totalAmount: number,
): string | null {
  const totalCents = toCents(totalAmount);
  if (totalCents < 0) {
    return "Total amount must be zero or greater.";
  }
  const lockedIds = selectedIds.filter((id) => isLocked(inputs[id]));
  const unlockedIds = selectedIds.filter((id) => !isLocked(inputs[id]));
  const lockedTotalCents = lockedIds.reduce(
    (sum, id) => sum + parseAmountCents(inputs[id]?.amount ?? "0"),
    0,
  );
  if (lockedTotalCents > totalCents) {
    return "Locked amounts exceed the total amount. Reduce locked values or unlock some members.";
  }
  if (unlockedIds.length === 0) {
    const selectedTotalCents = selectedIds.reduce(
      (sum, id) => sum + parseAmountCents(inputs[id]?.amount ?? "0"),
      0,
    );
    if (selectedTotalCents !== totalCents) {
      return "All selected members are locked, but their total does not match the expense amount.";
    }
  }
  return null;
}

export function rebalanceExactSplitInputs(
  inputs: Record<string, MemberSplitInput>,
  selectedIds: string[],
  totalAmount: number,
  changedId?: string,
): Record<string, MemberSplitInput> {
  if (selectedIds.length === 0) return inputs;

  const next = { ...inputs };
  const lockedIds = selectedIds.filter((id) => isLocked(next[id]));
  const unlockedIds = selectedIds.filter((id) => !isLocked(next[id]));
  const totalCents = toCents(Math.max(0, totalAmount));
  const lockedTotalCents = lockedIds.reduce(
    (sum, id) => sum + parseAmountCents(next[id]?.amount ?? "0"),
    0,
  );
  const availableTotalCents = Math.max(0, totalCents - lockedTotalCents);

  if (unlockedIds.length === 0) return next;

  if (changedId && unlockedIds.includes(changedId) && unlockedIds.length > 1) {
    const changedAmountCents = parseAmountCents(next[changedId]?.amount ?? "0");
    const clampedChangedCents = Math.min(Math.max(changedAmountCents, 0), availableTotalCents);
    const others = unlockedIds.filter((id) => id !== changedId);
    const remainderCents = availableTotalCents - clampedChangedCents;
    const currentOthersTotalCents = others.reduce(
      (sum, id) => sum + parseAmountCents(next[id]?.amount ?? "0"),
      0,
    );
    const centsById = new Map<string, number>();
    centsById.set(changedId, clampedChangedCents);

    if (others.length > 0) {
      if (currentOthersTotalCents > 0) {
        const base = others.map((id) => {
          const ratio = parseAmountCents(next[id]?.amount ?? "0") / currentOthersTotalCents;
          return Math.floor(remainderCents * ratio);
        });
        const used = base.reduce((sum, value) => sum + value, 0);
        const leftover = remainderCents - used;
        others.forEach((id, index) => {
          centsById.set(id, base[index]! + (index < leftover ? 1 : 0));
        });
      } else {
        const evenDistribution = distributeEvenly(remainderCents, others);
        for (const [id, cents] of evenDistribution.entries()) {
          centsById.set(id, cents);
        }
      }
    }
    return writeCents(next, centsById);
  }

  if (changedId && unlockedIds.includes(changedId) && unlockedIds.length === 1) {
    const targetCents = Math.min(
      Math.max(parseAmountCents(next[changedId]?.amount ?? "0"), 0),
      availableTotalCents,
    );
    return writeCents(next, new Map([[changedId, targetCents]]));
  }

  // Manual "Balance Amounts": prefer whole-unit allocations for readability.
  // If the available amount contains cents, the last member absorbs that remainder.
  const wholeUnits = Math.floor(availableTotalCents / 100);
  const centRemainder = availableTotalCents - wholeUnits * 100;
  const unitDistribution = distributeEvenly(wholeUnits, unlockedIds);
  const centsById = new Map<string, number>();
  unlockedIds.forEach((id) => {
    centsById.set(id, (unitDistribution.get(id) ?? 0) * 100);
  });
  if (centRemainder > 0 && unlockedIds.length > 0) {
    const targetId = unlockedIds[unlockedIds.length - 1]!;
    centsById.set(targetId, (centsById.get(targetId) ?? 0) + centRemainder);
  }
  return writeCents(next, centsById);
}

function sumAmountsCents(ids: string[], inputs: Record<string, MemberSplitInput>): number {
  return ids.reduce((sum, id) => sum + parseAmountCents(inputs[id]?.amount ?? "0"), 0);
}

function formatCents(cents: number): string {
  return fromCents(cents).toFixed(2);
}

function parseAmountForSplit(value: string): number {
  const cents = parseAmountCents(value);
  return fromCents(cents);
}

function sumSplitAmounts(selectedMemberIds: string[], memberSplitInputs: Record<string, MemberSplitInput>): number {
  const cents = sumAmountsCents(selectedMemberIds, memberSplitInputs);
  return fromCents(cents);
}

function hasMissingSplitInputs(
  selectedMemberIds: string[],
  memberSplitInputs: Record<string, MemberSplitInput>,
): boolean {
  return selectedMemberIds.some((id) => !memberSplitInputs[id]?.amount || memberSplitInputs[id]?.amount === "");
}

function exactSplitError(totalAmount: number, exactTotal: number): string {
  return `Exact amounts must sum to ${formatCents(toCents(totalAmount))} (current: ${formatCents(toCents(exactTotal))})`;
}

function percentageSplitError(): string {
  return "Percentages must sum to 100%.";
}

function sharesSplitError(): string {
  return "Total shares must be greater than 0.";
}

function missingSplitError(): string {
  return "All members must have an input";
}

function validateExactTotal(totalAmount: number, exactTotal: number): boolean {
  return toCents(exactTotal) === toCents(totalAmount);
}

function buildSplit(memberId: string, amount: number): { memberId: string; amount: number } {
  return { memberId, amount };
}

function parsePercentage(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseShares(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseExact(value: string): number {
  return parseAmountForSplit(value);
}

function safeDivide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function sumPercentages(selectedMemberIds: string[], memberSplitInputs: Record<string, MemberSplitInput>): number {
  return selectedMemberIds.reduce((sum, id) => sum + parsePercentage(memberSplitInputs[id]?.amount ?? ""), 0);
}

function sumShares(selectedMemberIds: string[], memberSplitInputs: Record<string, MemberSplitInput>): number {
  return selectedMemberIds.reduce((sum, id) => sum + parseShares(memberSplitInputs[id]?.amount ?? ""), 0);
}

function sumExacts(selectedMemberIds: string[], memberSplitInputs: Record<string, MemberSplitInput>): number {
  return sumSplitAmounts(selectedMemberIds, memberSplitInputs);
}

function isPercentageValid(totalPercent: number): boolean {
  return Math.abs(totalPercent - 100) <= 0.01;
}

function normalizeMoney(value: number): number {
  return fromCents(toCents(value));
}

function buildEqualSplits(totalAmount: number, selectedMemberIds: string[]) {
  const amount = safeDivide(totalAmount, selectedMemberIds.length);
  return selectedMemberIds.map((memberId) => buildSplit(memberId, amount));
}

function buildPercentageSplits(
  totalAmount: number,
  selectedMemberIds: string[],
  memberSplitInputs: Record<string, MemberSplitInput>,
) {
  return selectedMemberIds.map((memberId) => {
    const percent = parsePercentage(memberSplitInputs[memberId]?.amount ?? "");
    return buildSplit(memberId, normalizeMoney((percent / 100) * totalAmount));
  });
}

function buildShareSplits(
  totalAmount: number,
  selectedMemberIds: string[],
  memberSplitInputs: Record<string, MemberSplitInput>,
  totalShares: number,
) {
  return selectedMemberIds.map((memberId) => {
    const shares = parseShares(memberSplitInputs[memberId]?.amount ?? "");
    return buildSplit(memberId, normalizeMoney((shares / totalShares) * totalAmount));
  });
}

function buildExactSplits(
  selectedMemberIds: string[],
  memberSplitInputs: Record<string, MemberSplitInput>,
) {
  return selectedMemberIds.map((memberId) => buildSplit(memberId, parseExact(memberSplitInputs[memberId]?.amount ?? "")));
}

export function rebalancePercentageSplitInputs(
  inputs: Record<string, MemberSplitInput>,
  selectedIds: string[],
): Record<string, MemberSplitInput> {
  if (selectedIds.length === 0) return inputs;
  const isLocked = (input: MemberSplitInput | undefined): boolean =>
    Boolean((input as MemberSplitInput & { locked?: boolean } | undefined)?.locked);
  const next = { ...inputs };
  const totalBasisPoints = 10_000; // 100.00%
  const lockedIds = selectedIds.filter((id) => isLocked(next[id]));
  const unlockedIds = selectedIds.filter((id) => !isLocked(next[id]));
  const lockedTotalBasisPoints = lockedIds.reduce(
    (sum, id) => sum + Math.max(0, Math.round(parsePercentage(next[id]?.amount ?? "0") * 100)),
    0,
  );
  const availableBasisPoints = Math.max(0, totalBasisPoints - lockedTotalBasisPoints);
  const currentTotal = unlockedIds.reduce(
    (sum, id) => sum + Math.max(0, Math.round(parsePercentage(next[id]?.amount ?? "0") * 100)),
    0,
  );

  if (unlockedIds.length === 0) return next;

  const basisById = new Map<string, number>();
  if (currentTotal > 0) {
    const base = unlockedIds.map((id) => {
      const current = Math.max(0, Math.round(parsePercentage(next[id]?.amount ?? "0") * 100));
      return Math.floor((current / currentTotal) * availableBasisPoints);
    });
    const used = base.reduce((sum, value) => sum + value, 0);
    const remainder = availableBasisPoints - used;
    unlockedIds.forEach((id, index) => {
      basisById.set(id, base[index]! + (index < remainder ? 1 : 0));
    });
  } else {
    const even = Math.floor(availableBasisPoints / unlockedIds.length);
    const remainder = availableBasisPoints - even * unlockedIds.length;
    unlockedIds.forEach((id, index) => {
      basisById.set(id, even + (index < remainder ? 1 : 0));
    });
  }

  for (const id of unlockedIds) {
    const value = (basisById.get(id) ?? 0) / 100;
    next[id] = { ...next[id]!, amount: value.toFixed(2) };
  }
  return next;
}

export function calculateDiscountAdjustedPreview(
  totalAmount: number,
  splits: Array<{ memberId: string; amount: number }>,
  memberDiscounts: Record<string, "none" | "pwd" | "senior">,
): Record<string, number> {
  const totalCents = toCents(totalAmount);
  const splitCentsByMember = new Map<string, number>(
    splits.map((split) => [split.memberId, toCents(split.amount)]),
  );
  const adjustedCentsByMember = new Map<string, number>();
  let discountPoolCents = 0;

  for (const [memberId, originalCents] of splitCentsByMember.entries()) {
    const discountType = memberDiscounts[memberId] ?? "none";
    if (discountType === "none") {
      adjustedCentsByMember.set(memberId, originalCents);
      continue;
    }
    const reduction = Math.round(originalCents * 0.2);
    const discountedCents = Math.max(0, originalCents - reduction);
    adjustedCentsByMember.set(memberId, discountedCents);
    discountPoolCents += originalCents - discountedCents;
  }

  if (discountPoolCents > 0) {
    const recipientIds = Array.from(splitCentsByMember.keys()).filter(
      (memberId) => (memberDiscounts[memberId] ?? "none") === "none",
    );
    const finalRecipients = recipientIds.length > 0 ? recipientIds : Array.from(splitCentsByMember.keys());

    const weights = finalRecipients.map((memberId) => ({
      memberId,
      weight: Math.max(adjustedCentsByMember.get(memberId) ?? 0, 1),
    }));
    const totalWeight = weights.reduce((sum, item) => sum + item.weight, 0);
    const base = weights.map((item) => ({
      memberId: item.memberId,
      cents: Math.floor((discountPoolCents * item.weight) / totalWeight),
    }));
    const used = base.reduce((sum, item) => sum + item.cents, 0);
    const remainder = discountPoolCents - used;
    base.forEach((entry, index) => {
      const withRemainder = entry.cents + (index < remainder ? 1 : 0);
      adjustedCentsByMember.set(
        entry.memberId,
        (adjustedCentsByMember.get(entry.memberId) ?? 0) + withRemainder,
      );
    });
  }

  const finalTotal = Array.from(adjustedCentsByMember.values()).reduce((sum, cents) => sum + cents, 0);
  if (finalTotal !== totalCents) {
    const ids = Array.from(adjustedCentsByMember.keys());
    const fallbackId = ids[ids.length - 1];
    if (fallbackId) {
      adjustedCentsByMember.set(
        fallbackId,
        (adjustedCentsByMember.get(fallbackId) ?? 0) + (totalCents - finalTotal),
      );
    }
  }

  return Array.from(adjustedCentsByMember.entries()).reduce<Record<string, number>>(
    (acc, [memberId, cents]) => {
      acc[memberId] = fromCents(cents);
      return acc;
    },
    {},
  );
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
      return {
        ok: true,
        splits: buildEqualSplits(totalAmount, selectedMemberIds),
      };
    }

    case "percentage": {
      const totalPercent = sumPercentages(selectedMemberIds, memberSplitInputs);
      if (!isPercentageValid(totalPercent)) {
        return { ok: false, error: percentageSplitError() };
      }
      return {
        ok: true,
        splits: buildPercentageSplits(totalAmount, selectedMemberIds, memberSplitInputs),
      };
    }

    case "shares": {
      if (hasMissingSplitInputs(selectedMemberIds, memberSplitInputs)) {
        return { ok: false, error: missingSplitError() };
      }

      const totalShares = sumShares(selectedMemberIds, memberSplitInputs);
      if (totalShares <= 0) {
        return { ok: false, error: sharesSplitError() };
      }
      return {
        ok: true,
        splits: buildShareSplits(totalAmount, selectedMemberIds, memberSplitInputs, totalShares),
      };
    }

    case "exact": {
      if (hasMissingSplitInputs(selectedMemberIds, memberSplitInputs)) {
        return { ok: false, error: missingSplitError() };
      }

      const exactTotal = sumExacts(selectedMemberIds, memberSplitInputs);
      if (!validateExactTotal(totalAmount, exactTotal)) {
        return { ok: false, error: exactSplitError(totalAmount, exactTotal) };
      }

      return {
        ok: true,
        splits: buildExactSplits(selectedMemberIds, memberSplitInputs),
      };
    }

    case "itemized":
    default:
      return {
        ok: false,
        error: "Itemized expenses are handled separately.",
      };
  }
}

// =============================================================================
// Rounding correction
// =============================================================================

/**
 * Floors all amounts to 2 decimal places, then adds any lost cents
 * to the first entry so the total always matches exactly.
 */
export function calculateItemizedSplits(
  manualItems: Array<{ name: string; price: string }>,
  itemAssignments: Record<number, string[]>,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [indexStr, assignedIds] of Object.entries(itemAssignments)) {
    const index = parseInt(indexStr, 10);
    const item = manualItems[index];
    if (!item) continue;
    const price = parseFloat(item.price);
    if (price <= 0 || assignedIds.length === 0) continue;
    const perPerson = price / assignedIds.length;
    for (const memberId of assignedIds) {
      result[memberId] = (result[memberId] ?? 0) + perPerson;
    }
  }
  return result;
}

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
