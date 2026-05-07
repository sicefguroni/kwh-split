import { badRequest } from "../../utils/errors.js";
import type { ExpenseWriteInput, MemberDiscountType } from "./expenses.schemas.js";

export interface CalculatedSplit {
  userId: number;
  amountOwed: number;
  percentage: number | null;
  share: number | null;
}

export interface CalculatedReceiptItem {
  itemName: string;
  price: number;
  assignedUserIds: number[];
}

export interface CalculatedMemberDiscount {
  userId: number;
  type: Exclude<MemberDiscountType, "none">;
  ratePercent: number;
}

interface CalculationResult {
  splits: CalculatedSplit[];
  receiptItems: CalculatedReceiptItem[];
  memberDiscounts: CalculatedMemberDiscount[];
}

const toCents = (value: number): number => Math.round(value * 100);
const toAmount = (cents: number): number => cents / 100;
const MEMBER_DISCOUNT_RATE_PERCENT: Record<Exclude<MemberDiscountType, "none">, number> = {
  pwd: 20,
  senior: 20,
};

const distributeByWeights = (
  totalCents: number,
  weights: Array<{ userId: number; weight: number }>,
): Array<{ userId: number; cents: number }> => {
  const totalWeight = weights.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    throw badRequest("Split weights must be positive", "invalid_split_weights");
  }
  const base = weights.map((entry) => ({
    userId: entry.userId,
    raw: (totalCents * entry.weight) / totalWeight,
  }));
  const rounded = base.map((entry) => ({
    userId: entry.userId,
    cents: Math.floor(entry.raw),
    remainder: entry.raw - Math.floor(entry.raw),
  }));
  let allocated = rounded.reduce((sum, entry) => sum + entry.cents, 0);
  let leftover = totalCents - allocated;
  rounded
    .sort((a, b) => b.remainder - a.remainder || a.userId - b.userId)
    .forEach((entry) => {
      if (leftover > 0) {
        entry.cents += 1;
        allocated += 1;
        leftover -= 1;
      }
    });
  return rounded.map(({ userId, cents }) => ({ userId, cents }));
};

const normalizeParticipants = (
  input: ExpenseWriteInput,
  memberIds: number[],
): number[] => {
  const participants = input.participantUserIds?.length
    ? Array.from(new Set(input.participantUserIds))
    : memberIds;
  if (participants.length === 0) {
    throw badRequest("Expense must include at least one participant", "missing_participants");
  }
  const memberSet = new Set(memberIds);
  for (const participant of participants) {
    if (!memberSet.has(participant)) {
      throw badRequest("Participants must belong to the group", "invalid_participants");
    }
  }
  return participants;
};

const calculateEqualSplits = (totalCents: number, participants: number[]): CalculatedSplit[] => {
  const allocations = distributeByWeights(
    totalCents,
    participants.map((userId) => ({ userId, weight: 1 })),
  );
  return allocations.map(({ userId, cents }) => ({
    userId,
    amountOwed: toAmount(cents),
    percentage: null,
    share: null,
  }));
};

const requireSplits = (input: ExpenseWriteInput) => {
  if (!input.splits?.length) {
    throw badRequest("splits are required for this split type", "missing_splits");
  }
  return input.splits;
};

const calculatePercentageSplits = (totalCents: number, input: ExpenseWriteInput): CalculatedSplit[] => {
  const splits = requireSplits(input);
  const sum = splits.reduce((acc, split) => acc + (split.percentage ?? 0), 0);
  if (Math.abs(sum - 100) > 0.01) {
    throw badRequest("Percentage splits must sum to 100", "invalid_percentage_split");
  }
  const allocations = distributeByWeights(
    totalCents,
    splits.map((split) => ({ userId: split.userId, weight: split.percentage ?? 0 })),
  );
  const lookup = new Map(splits.map((split) => [split.userId, split]));
  return allocations.map(({ userId, cents }) => ({
    userId,
    amountOwed: toAmount(cents),
    percentage: lookup.get(userId)?.percentage ?? null,
    share: null,
  }));
};

const calculateShareSplits = (totalCents: number, input: ExpenseWriteInput): CalculatedSplit[] => {
  const splits = requireSplits(input);
  const allocations = distributeByWeights(
    totalCents,
    splits.map((split) => ({ userId: split.userId, weight: split.share ?? 0 })),
  );
  const lookup = new Map(splits.map((split) => [split.userId, split]));
  return allocations.map(({ userId, cents }) => ({
    userId,
    amountOwed: toAmount(cents),
    percentage: null,
    share: lookup.get(userId)?.share ?? null,
  }));
};

const calculateExactSplits = (totalCents: number, input: ExpenseWriteInput): CalculatedSplit[] => {
  const splits = requireSplits(input);
  const sum = splits.reduce((acc, split) => acc + toCents(split.amount ?? 0), 0);
  if (sum !== totalCents) {
    throw badRequest("Exact split amounts must equal total amount", "invalid_exact_split");
  }
  return splits.map((split) => ({
    userId: split.userId,
    amountOwed: split.amount ?? 0,
    percentage: null,
    share: null,
  }));
};

const calculateItemizedSplits = (totalCents: number, input: ExpenseWriteInput): CalculationResult => {
  if (!input.receiptItems?.length) {
    throw badRequest("receiptItems are required for itemized split", "missing_receipt_items");
  }
  const subtotalByUser = new Map<number, number>();
  let subtotalCents = 0;
  for (const item of input.receiptItems) {
    const itemCents = toCents(item.price);
    subtotalCents += itemCents;
    const allocations = distributeByWeights(
      itemCents,
      item.assignedUserIds.map((userId) => ({ userId, weight: 1 })),
    );
    for (const allocation of allocations) {
      subtotalByUser.set(
        allocation.userId,
        (subtotalByUser.get(allocation.userId) ?? 0) + allocation.cents,
      );
    }
  }

  const taxCents = toCents(input.taxAmount);
  const tipCents = toCents(input.tipAmount);
  const expectedSubtotal = totalCents - taxCents - tipCents;
  if (expectedSubtotal < 0) {
    throw badRequest("Tax and tip cannot exceed total", "invalid_tax_tip");
  }
  if (Math.abs(expectedSubtotal - subtotalCents) > 1) {
    throw badRequest(
      "Receipt item totals must equal total minus tax/tip",
      "invalid_itemized_totals",
    );
  }

  const userWeights = Array.from(subtotalByUser.entries()).map(([userId, cents]) => ({
    userId,
    weight: Math.max(cents, 1),
  }));
  const taxAlloc = distributeByWeights(taxCents, userWeights);
  const tipAlloc = distributeByWeights(tipCents, userWeights);
  const taxByUser = new Map(taxAlloc.map((entry) => [entry.userId, entry.cents]));
  const tipByUser = new Map(tipAlloc.map((entry) => [entry.userId, entry.cents]));

  const splits: CalculatedSplit[] = userWeights.map(({ userId }) => {
    const base = subtotalByUser.get(userId) ?? 0;
    const total = base + (taxByUser.get(userId) ?? 0) + (tipByUser.get(userId) ?? 0);
    return {
      userId,
      amountOwed: toAmount(total),
      percentage: null,
      share: null,
    };
  });
  return {
    splits,
    receiptItems: input.receiptItems.map((item) => ({
      itemName: item.itemName,
      price: item.price,
      assignedUserIds: Array.from(new Set(item.assignedUserIds)),
    })),
    memberDiscounts: [],
  };
};

const applyMemberDiscounts = (
  splits: CalculatedSplit[],
  totalCents: number,
  participantSet: Set<number>,
  input: ExpenseWriteInput,
): { splits: CalculatedSplit[]; memberDiscounts: CalculatedMemberDiscount[] } => {
  const requestedDiscounts = input.memberDiscounts ?? [];
  if (!requestedDiscounts.length) {
    return { splits, memberDiscounts: [] };
  }
  const splitByUserId = new Map<number, CalculatedSplit>(splits.map((split) => [split.userId, split]));
  const discountByUserId = new Map<number, CalculatedMemberDiscount>();
  for (const entry of requestedDiscounts) {
    if (entry.type === "none") continue;
    if (!participantSet.has(entry.userId)) {
      throw badRequest("Discount user must be part of participants", "invalid_discount_participant");
    }
    const split = splitByUserId.get(entry.userId);
    if (!split) {
      throw badRequest("Discount user must have a split allocation", "missing_discount_split");
    }
    discountByUserId.set(entry.userId, {
      userId: entry.userId,
      type: entry.type,
      ratePercent: MEMBER_DISCOUNT_RATE_PERCENT[entry.type],
    });
  }
  if (discountByUserId.size === 0) {
    return { splits, memberDiscounts: [] };
  }

  const discountedCentsByUserId = new Map<number, number>();
  let discountPoolCents = 0;
  for (const split of splits) {
    const originalCents = toCents(split.amountOwed);
    const discount = discountByUserId.get(split.userId);
    if (!discount) {
      discountedCentsByUserId.set(split.userId, originalCents);
      continue;
    }
    const reduction = Math.round((originalCents * discount.ratePercent) / 100);
    const discountedCents = Math.max(0, originalCents - reduction);
    discountedCentsByUserId.set(split.userId, discountedCents);
    discountPoolCents += originalCents - discountedCents;
  }

  if (discountPoolCents > 0) {
    const recipients = splits.filter((split) => !discountByUserId.has(split.userId));
    const recipientPool = recipients.length > 0 ? recipients : splits;
    const redistributed = distributeByWeights(
      discountPoolCents,
      recipientPool.map((split) => ({
        userId: split.userId,
        weight: Math.max(discountedCentsByUserId.get(split.userId) ?? 0, 1),
      })),
    );
    for (const entry of redistributed) {
      discountedCentsByUserId.set(
        entry.userId,
        (discountedCentsByUserId.get(entry.userId) ?? 0) + entry.cents,
      );
    }
  }

  const normalizedSplits = splits.map((split) => ({
    ...split,
    amountOwed: toAmount(discountedCentsByUserId.get(split.userId) ?? 0),
  }));
  const assigned = normalizedSplits.reduce((sum, split) => sum + toCents(split.amountOwed), 0);
  if (assigned !== totalCents) {
    throw badRequest("Discounted split totals do not match expense total", "discount_split_mismatch");
  }
  return {
    splits: normalizedSplits,
    memberDiscounts: Array.from(discountByUserId.values()),
  };
};

export const calculateExpenseDetails = (
  input: ExpenseWriteInput,
  groupMemberIds: number[],
): CalculationResult => {
  const participants = normalizeParticipants(input, groupMemberIds);
  const participantSet = new Set(participants);
  const totalCents = toCents(input.totalAmount);

  let result: CalculationResult;
  if (input.splitType === "equal") {
    result = { splits: calculateEqualSplits(totalCents, participants), receiptItems: [], memberDiscounts: [] };
  } else if (input.splitType === "percentage") {
    result = { splits: calculatePercentageSplits(totalCents, input), receiptItems: [], memberDiscounts: [] };
  } else if (input.splitType === "shares") {
    result = { splits: calculateShareSplits(totalCents, input), receiptItems: [], memberDiscounts: [] };
  } else if (input.splitType === "exact") {
    result = { splits: calculateExactSplits(totalCents, input), receiptItems: [], memberDiscounts: [] };
  } else {
    result = calculateItemizedSplits(totalCents, input);
  }

  for (const split of result.splits) {
    if (!participantSet.has(split.userId)) {
      throw badRequest("Split user must be part of participants", "invalid_split_participant");
    }
  }
  const totalAssigned = toCents(result.splits.reduce((sum, split) => sum + split.amountOwed, 0));
  if (totalAssigned !== totalCents) {
    throw badRequest("Calculated split totals do not match expense total", "split_mismatch");
  }
  const withDiscounts = applyMemberDiscounts(result.splits, totalCents, participantSet, input);
  return {
    ...result,
    splits: withDiscounts.splits,
    memberDiscounts: withDiscounts.memberDiscounts,
  };
};
