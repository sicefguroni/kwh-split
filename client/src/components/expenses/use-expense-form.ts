import { useEffect, useMemo, useState } from "react";
import {
  type GroupExpense,
  type GroupMember,
  type MemberSplitInput,
  type SplitType,
} from "./types";
import type { PayerEntry } from "@/features/groups/domain";
import {
  applyRoundingCorrection,
  buildDefaultSplitInputs,
  calculateDiscountAdjustedPreview,
  calculateItemizedSplits,
  calculateSplits,
  generateExpenseId,
  rebalancePercentageSplitInputs,
  rebalanceExactSplitInputs,
  todayISODate,
  validateExactSplitState,
} from "./expense-utils";

export interface PayerInput {
  userId: string;
  amount: string;
}

interface UseExpenseFormOptions {
  isOpen: boolean;
  initialData?: GroupExpense | undefined;
  members: GroupMember[];
  currency: string;
  onSubmit: (expense: GroupExpense) => Promise<void> | void;
  manualItems?: Array<{ name: string; price: string }>;
  itemAssignments?: Record<number, string[]>;
}

interface UseExpenseFormReturn {
  // Step
  step: 1 | 2 | 3;
  // Step 1 fields
  expenseName: string;
  setExpenseName: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  paidBy: string;
  setPaidBy: (v: string) => void;
  payers: PayerInput[];
  setPayers: (payers: PayerInput[]) => void;
  date: string;
  setDate: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  // Step 2 fields
  splitType: SplitType;
  setSplitType: (v: SplitType) => void;
  memberSplitInputs: Record<string, MemberSplitInput>;
  updateMemberSplitInput: (memberId: string, patch: Partial<MemberSplitInput>) => void;
  updateExactAmount: (memberId: string, amount: string) => void;
  updateMemberDiscountType: (memberId: string, discountType: "none" | "pwd" | "senior") => void;
  toggleMemberLock: (memberId: string) => void;
  toggleMemberSelected: (memberId: string, selected: boolean) => void;
  rebalanceExactAllocations: (changedId?: string) => void;
  rebalancePercentageAllocations: () => void;
  // Step 3 data
  totalAmount: number;
  computedSplits: Record<string, number>;
  discountAdjustedPreview: Record<string, number>;
  // Feedback
  error: string;
  // Handlers
  handleNextStep1: () => void;
  handleNextStep2: () => void;
  handleSubmit: () => Promise<void>;
  goToStep: (s: 1 | 2 | 3) => void;
}

type LockableMemberSplitInput = MemberSplitInput & { locked?: boolean };

export function useExpenseForm({
  isOpen,
  initialData,
  members,
  currency,
  onSubmit,
  manualItems,
  itemAssignments,
}: UseExpenseFormOptions): UseExpenseFormReturn {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [expenseName, setExpenseName] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(members[0]?.id ?? "");
  const [payers, setPayers] = useState<PayerInput[]>([{ userId: members[0]?.id ?? "", amount: "" }]);
  const [date, setDate] = useState(todayISODate());
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("General");
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [memberSplitInputs, setMemberSplitInputs] = useState<Record<string, MemberSplitInput>>(
    () => buildDefaultSplitInputs(members),
  );
  const [computedSplits, setComputedSplits] = useState<Record<string, number>>({});
  const [error, setError] = useState("");

  const totalAmount = useMemo(() => parseFloat(amount) || 0, [amount]);
  const discountAdjustedPreview = useMemo(() => {
    if (splitType === "itemized") {
      return calculateItemizedSplits(manualItems ?? [], itemAssignments ?? {});
    }
    const selectedMemberIds = Object.entries(memberSplitInputs)
      .filter(([, split]) => split.selected)
      .map(([memberId]) => memberId);
    if (selectedMemberIds.length === 0 || totalAmount <= 0) return {};
    const splitResult = calculateSplits(
      splitType,
      totalAmount,
      selectedMemberIds,
      memberSplitInputs,
    );
    if (!splitResult.ok) return {};
    const corrected = applyRoundingCorrection(
      splitResult.splits.map((entry) => ({
        memberId: entry.memberId,
        amount: entry.amount,
      })),
      totalAmount,
    );
    return calculateDiscountAdjustedPreview(
      totalAmount,
      corrected.map((entry) => ({ memberId: entry.memberId, amount: entry.amount })),
      Object.entries(memberSplitInputs).reduce<Record<string, "none" | "pwd" | "senior">>(
        (acc, [memberId, split]) => {
          acc[memberId] = split.discountType ?? "none";
          return acc;
        },
        {},
      ),
    );
  }, [memberSplitInputs, splitType, totalAmount, manualItems, itemAssignments]);

  // ---------------------------------------------------------------------------
  // Reset / populate on open
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isOpen) return;
    setExpenseName(initialData?.name ?? "");
    setAmount(initialData?.amount.toString() ?? "");
    setPaidBy(initialData?.paidBy ?? members[0]?.id ?? "");
    setPayers(
      initialData?.payerAmounts?.length
        ? initialData.payerAmounts.map((p: PayerEntry) => ({
            userId: p.userId,
            amount: p.amountPaid.toFixed(2),
          }))
        : [{ userId: initialData?.paidBy ?? members[0]?.id ?? "", amount: initialData?.amount?.toFixed(2) ?? "" }],
    );
    setDate(initialData?.date ?? todayISODate());
    setNote(initialData?.note ?? "");
    setCategory(initialData?.category ?? "General");
    setSplitType((initialData?.splitType as SplitType | undefined) ?? "equal");
    setMemberSplitInputs(buildDefaultSplitInputs(members, initialData));
    setComputedSplits({});
    setStep(1);
    setError("");
  }, [isOpen, initialData, members]);

  // ---------------------------------------------------------------------------
  // Auto-distribute total equally among payers when total or payer count changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (totalAmount <= 0 || payers.length === 0) return;

    setPayers((prev) => {
      const count = prev.length;
      if (count === 0) return prev;

      // If all payers already have amounts that sum to total, preserve manual entries
      const allFilled = prev.every((p) => p.amount && parseFloat(p.amount) > 0);
      const currentSum = prev.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
      if (allFilled && Math.abs(currentSum - totalAmount) < 0.01) {
        return prev;
      }

      // Distribute equally, last payer gets rounding remainder
      const equalShare = totalAmount / count;
      const roundedAmount = parseFloat(equalShare.toFixed(2));
      const sumPrev = roundedAmount * (count - 1);

      return prev.map((payer, i) => ({
        userId: payer.userId,
        amount:
          i < count - 1
            ? roundedAmount.toFixed(2)
            : (totalAmount - sumPrev).toFixed(2),
      }));
    });
  }, [totalAmount, payers.length]);

  // ---------------------------------------------------------------------------
  // Auto-fill equal amounts when split type or total changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    setMemberSplitInputs((prev) => {
      const updated = { ...prev };
      const selectedIds = Object.keys(updated).filter((id) => updated[id]?.selected);

      if (splitType === "equal") {
        const splitAmount =
          selectedIds.length > 0 && totalAmount > 0
            ? (totalAmount / selectedIds.length).toFixed(2)
            : "";
        for (const id of selectedIds) {
          updated[id] = { ...updated[id]!, amount: splitAmount };
        }
      } else if (splitType !== "exact") {
        for (const id in updated) {
          if (updated[id]?.selected) {
            updated[id] = { ...updated[id]!, amount: "" };
          }
        }
      }

      return updated;
    });
  }, [splitType, totalAmount]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function updateMemberSplitInput(memberId: string, patch: Partial<MemberSplitInput>) {
    setMemberSplitInputs((prev) => {
      const current = prev[memberId];
      if (!current) return prev;
      return { ...prev, [memberId]: { ...current, ...patch } };
    });
  }

  function rebalanceExactAllocations(changedId?: string) {
    if (splitType !== "exact") return;
    setMemberSplitInputs((prev) => {
      const selectedIds = Object.entries(prev)
        .filter(([, split]) => split.selected)
        .map(([id]) => id);
      const rebalanced = rebalanceExactSplitInputs(prev, selectedIds, totalAmount, changedId);
      const validationError = validateExactSplitState(rebalanced, selectedIds, totalAmount);
      setError(validationError ?? "");
      return rebalanced;
    });
  }

  function rebalancePercentageAllocations() {
    if (splitType !== "percentage") return;
    setMemberSplitInputs((prev) => {
      const selectedIds = Object.entries(prev)
        .filter(([, split]) => split.selected)
        .map(([id]) => id);
      return rebalancePercentageSplitInputs(prev, selectedIds);
    });
  }

  function updateExactAmount(memberId: string, value: string) {
    setMemberSplitInputs((prev) => {
      const current = prev[memberId];
      if (!current) return prev;
      return { ...prev, [memberId]: { ...current, amount: value } };
    });
  }

  function applyDiscountsToAllocationAmounts(
    next: Record<string, MemberSplitInput>,
  ): Record<string, MemberSplitInput> {
    if (splitType !== "exact" && splitType !== "equal") return next;
    const selectedMemberIds = Object.entries(next)
      .filter(([, split]) => split.selected)
      .map(([memberId]) => memberId);
    if (selectedMemberIds.length === 0 || totalAmount <= 0) return next;

    const splitResult = calculateSplits(splitType, totalAmount, selectedMemberIds, next);
    if (!splitResult.ok) return next;

    const corrected = applyRoundingCorrection(
      splitResult.splits.map((entry) => ({
        memberId: entry.memberId,
        amount: entry.amount,
      })),
      totalAmount,
    );

    const adjusted = calculateDiscountAdjustedPreview(
      totalAmount,
      corrected.map((entry) => ({ memberId: entry.memberId, amount: entry.amount })),
      Object.entries(next).reduce<Record<string, "none" | "pwd" | "senior">>((acc, [memberId, split]) => {
        acc[memberId] = split.discountType ?? "none";
        return acc;
      }, {}),
    );

    for (const memberId of selectedMemberIds) {
      if (adjusted[memberId] === undefined) continue;
      next[memberId] = {
        ...next[memberId]!,
        amount: adjusted[memberId]!.toFixed(2),
      };
    }
    return next;
  }

  function updateMemberDiscountType(
    memberId: string,
    discountType: "none" | "pwd" | "senior",
  ) {
    setMemberSplitInputs((prev) => {
      const current = prev[memberId];
      if (!current) return prev;
      const next = {
        ...prev,
        [memberId]: {
          ...current,
          discountType,
        },
      };
      return applyDiscountsToAllocationAmounts(next);
    });
  }

  function toggleMemberLock(memberId: string) {
    setMemberSplitInputs((prev) => {
      const current = prev[memberId];
      if (!current) return prev;
      const next = {
        ...prev,
        [memberId]: {
          ...current,
          locked: !((current as LockableMemberSplitInput).locked ?? false),
        } as LockableMemberSplitInput,
      };
      return next;
    });
  }

  function toggleMemberSelected(memberId: string, selected: boolean) {
    setMemberSplitInputs((prev) => {
      const current = prev[memberId];
      if (!current) return prev;
      const next = {
        ...prev,
        [memberId]: {
          ...current,
          selected,
        },
      };
      if (splitType === "equal") {
        const selectedIds = Object.entries(next)
          .filter(([, split]) => split.selected)
          .map(([id]) => id);
        const splitAmount =
          selectedIds.length > 0 && totalAmount > 0
            ? (totalAmount / selectedIds.length).toFixed(2)
            : "";
        for (const id of selectedIds) {
          next[id] = { ...next[id]!, amount: splitAmount };
        }
        if (!selected) {
          next[memberId] = { ...next[memberId]!, amount: "" };
        }
      }
      return applyDiscountsToAllocationAmounts(next);
    });
  }

  function resetForm() {
    setStep(1);
    setExpenseName("");
    setAmount("");
    setPaidBy(members[0]?.id ?? "");
    setPayers([{ userId: members[0]?.id ?? "", amount: "" }]);
    setDate(todayISODate());
    setNote("");
    setCategory("General");
    setSplitType("equal");
    setMemberSplitInputs(buildDefaultSplitInputs(members));
    setComputedSplits({});
    setError("");
  }

  // ---------------------------------------------------------------------------
  // Step handlers
  // ---------------------------------------------------------------------------

  function handleNextStep1() {
    if (!expenseName.trim() || !amount) {
      setError("Please fill in the expense name and amount.");
      return;
    }
    setError("");

    // Auto-fill any payer with empty amount before validating
    const allHaveAmounts = payers.every((p) => p.amount && parseFloat(p.amount) > 0);
    const currentSum = payers.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const adjustedPayers =
      !allHaveAmounts || Math.abs(currentSum - totalAmount) >= 0.01
        ? (() => {
            const count = payers.length;
            const equalShare = totalAmount / count;
            const roundedAmount = parseFloat(equalShare.toFixed(2));
            const sumPrev = roundedAmount * (count - 1);
            return payers.map((p, i) => ({
              userId: p.userId,
              amount:
                i < count - 1
                  ? roundedAmount.toFixed(2)
                  : (totalAmount - sumPrev).toFixed(2),
            }));
          })()
        : payers;

    const payerTotal = adjustedPayers.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    if (Math.abs(payerTotal - totalAmount) > 0.01) {
      setError(`Payer amounts (${payerTotal.toFixed(2)}) must equal total amount (${totalAmount.toFixed(2)}).`);
      return;
    }

    // Sync auto-filled amount back to state
    if (adjustedPayers !== payers) {
      setPayers(adjustedPayers);
    }

    setStep(2);
  }

  function handleNextStep2() {
    setError("");

    if (splitType === "itemized") {
      const validItems = (manualItems ?? []).filter(
        (item) => item.name.trim() && parseFloat(item.price) > 0,
      );
      if (validItems.length === 0) {
        setError("No items to split. Add items in step 1 first.");
        return;
      }
      for (let i = 0; i < (manualItems ?? []).length; i++) {
        const item = manualItems?.[i];
        if (!item?.name.trim() || parseFloat(item.price ?? "0") <= 0) continue;
        if (!itemAssignments?.[i]?.length) {
          setError(`"${item.name}" must be assigned to at least one member.`);
          return;
        }
      }
      const preview = calculateItemizedSplits(manualItems ?? [], itemAssignments ?? {});
      setComputedSplits(preview);
      setStep(3);
      return;
    }

    const selectedMemberIds = Object.entries(memberSplitInputs)
      .filter(([, split]) => split.selected)
      .map(([memberId]) => memberId);

    if (selectedMemberIds.length === 0) {
      setError("Please select at least one member.");
      return;
    }

    if (splitType === "exact") {
      const validationError = validateExactSplitState(memberSplitInputs, selectedMemberIds, totalAmount);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    const result = calculateSplits(splitType, totalAmount, selectedMemberIds, memberSplitInputs);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    const corrected = applyRoundingCorrection(result.splits, totalAmount);

    const finalSum = corrected.reduce((acc, e) => acc + e.amount, 0);
    if (Math.abs(finalSum - totalAmount) > 0.01) {
      setError(`Split total (${finalSum}) does not match expense amount (${totalAmount}).`);
      return;
    }

    setComputedSplits(
      corrected.reduce<Record<string, number>>((acc, { memberId, amount: amt }) => {
        acc[memberId] = amt;
        return acc;
      }, {}),
    );
    setStep(3);
  }

  async function handleSubmit() {
    if (!expenseName.trim()) {
      setError("Expense name is required.");
      setStep(1);
      return;
    }
    if (totalAmount <= 0) {
      setError("Please enter a valid amount.");
      setStep(1);
      return;
    }

    const itemizedReceiptItems =
      splitType === "itemized" && manualItems
        ? manualItems
            .filter((item) => item.name.trim() && parseFloat(item.price) > 0)
            .map((item, idx) => ({
              id: `item-${idx}`,
              itemName: item.name.trim(),
              price: parseFloat(item.price),
              assignedUserIds: itemAssignments?.[idx] ?? [],
            }))
        : undefined;

    const expense: GroupExpense = {
      id: initialData?.id ?? generateExpenseId(),
      name: expenseName.trim(),
      amount: totalAmount,
      currency,
      paidBy,
      payerAmounts: payers
        .filter((p) => p.userId && parseFloat(p.amount) > 0)
        .map((p) => ({
          userId: p.userId,
          amountPaid: parseFloat(p.amount),
        })),
      date,
      note: note.trim(),
      category: category || "General",
      splitType,
      ...(itemizedReceiptItems ? { receiptItems: itemizedReceiptItems } : {}),
      splits: splitType === "itemized"
        ? []
        : Object.entries(computedSplits)
            .filter(([, amt]) => amt > 0)
            .map(([memberId, amt]) => {
              const raw = parseFloat(memberSplitInputs[memberId]?.amount ?? "0");
              return {
                memberId,
                amount: amt,
                ...(splitType === "percentage" && { percentage: raw }),
                ...(splitType === "shares" && { share: raw }),
              };
            }),
      memberDiscounts: Object.entries(memberSplitInputs)
        .filter(([, split]) => split.selected)
        .map(([memberId, split]) => ({
          memberId,
          type: split.discountType ?? "none",
        })),
      status: initialData?.status ?? "pending",
    };

    try {
      await onSubmit(expense);
      resetForm();
    } catch (submissionError) {
      const message = submissionError instanceof Error ? submissionError.message : "Failed to save expense.";
      setError(message);
    }
  }

  return {
    step,
    expenseName,
    setExpenseName,
    amount,
    setAmount,
    paidBy,
    setPaidBy,
    payers,
    setPayers,
    date,
    setDate,
    note,
    setNote,
    category,
    setCategory,
    splitType,
    setSplitType,
    memberSplitInputs,
    updateMemberSplitInput,
    updateExactAmount,
    updateMemberDiscountType,
    toggleMemberLock,
    toggleMemberSelected,
    rebalanceExactAllocations,
    rebalancePercentageAllocations,
    totalAmount,
    computedSplits,
    discountAdjustedPreview,
    error,
    handleNextStep1,
    handleNextStep2,
    handleSubmit,
    goToStep: setStep,
  };
}
