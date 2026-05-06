import { useEffect, useMemo, useState } from "react";
import {
  type GroupExpense,
  type GroupMember,
  type MemberSplitInput,
  type SplitType,
} from "./types";
import {
  applyRoundingCorrection,
  buildDefaultSplitInputs,
  calculateSplits,
  generateExpenseId,
  todayISODate,
} from "./expense-utils";

interface UseExpenseFormOptions {
  isOpen: boolean;
  initialData?: GroupExpense | undefined;
  members: GroupMember[];
  currency: string;
  onSubmit: (expense: GroupExpense) => void;
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
  date: string;
  setDate: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  // Step 2 fields
  splitType: SplitType;
  setSplitType: (v: SplitType) => void;
  memberSplitInputs: Record<string, MemberSplitInput>;
  updateMemberSplitInput: (memberId: string, patch: Partial<MemberSplitInput>) => void;
  // Step 3 data
  totalAmount: number;
  computedSplits: Record<string, number>;
  // Feedback
  error: string;
  // Handlers
  handleNextStep1: () => void;
  handleNextStep2: () => void;
  handleSubmit: () => void;
  goToStep: (s: 1 | 2 | 3) => void;
}

export function useExpenseForm({
  isOpen,
  initialData,
  members,
  currency,
  onSubmit,
}: UseExpenseFormOptions): UseExpenseFormReturn {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [expenseName, setExpenseName] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(members[0]?.id ?? "");
  const [date, setDate] = useState(todayISODate());
  const [note, setNote] = useState("");
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [memberSplitInputs, setMemberSplitInputs] = useState<Record<string, MemberSplitInput>>(
    () => buildDefaultSplitInputs(members),
  );
  const [computedSplits, setComputedSplits] = useState<Record<string, number>>({});
  const [error, setError] = useState("");

  const totalAmount = useMemo(() => parseFloat(amount) || 0, [amount]);

  // ---------------------------------------------------------------------------
  // Reset / populate on open
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isOpen) return;
    setExpenseName(initialData?.name ?? "");
    setAmount(initialData?.amount.toString() ?? "");
    setPaidBy(initialData?.paidBy ?? members[0]?.id ?? "");
    setDate(initialData?.date ?? todayISODate());
    setNote(initialData?.note ?? "");
    setSplitType("equal");
    setMemberSplitInputs(buildDefaultSplitInputs(members, initialData));
    setComputedSplits({});
    setStep(1);
    setError("");
  }, [isOpen, initialData, members]);

  // ---------------------------------------------------------------------------
  // Auto-fill equal amounts when split type or total changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    setMemberSplitInputs((prev) => {
      const updated = { ...prev };

      if (splitType === "equal") {
        const selectedIds = Object.keys(updated).filter((id) => updated[id]?.selected);
        const splitAmount =
          selectedIds.length > 0 && totalAmount > 0
            ? (totalAmount / selectedIds.length).toFixed(2)
            : "";
        for (const id of selectedIds) {
          updated[id] = { ...updated[id]!, amount: splitAmount };
        }
      } else {
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

  function resetForm() {
    setStep(1);
    setExpenseName("");
    setAmount("");
    setPaidBy(members[0]?.id ?? "");
    setDate(todayISODate());
    setNote("");
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
    setStep(2);
  }

  function handleNextStep2() {
    setError("");

    const selectedMemberIds = Object.entries(memberSplitInputs)
      .filter(([, split]) => split.selected)
      .map(([memberId]) => memberId);

    if (selectedMemberIds.length === 0) {
      setError("Please select at least one member.");
      return;
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

  function handleSubmit() {
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

    const expense: GroupExpense = {
      id: initialData?.id ?? generateExpenseId(),
      name: expenseName.trim(),
      amount: totalAmount,
      currency,
      paidBy,
      date,
      note: note.trim(),
      splits: Object.entries(computedSplits)
        .filter(([, amt]) => amt > 0)
        .map(([memberId, amt]) => ({ memberId, amount: amt })),
      status: initialData?.status ?? "pending",
    };

    onSubmit(expense);
    resetForm();
  }

  return {
    step,
    expenseName,
    setExpenseName,
    amount,
    setAmount,
    paidBy,
    setPaidBy,
    date,
    setDate,
    note,
    setNote,
    splitType,
    setSplitType,
    memberSplitInputs,
    updateMemberSplitInput,
    totalAmount,
    computedSplits,
    error,
    handleNextStep1,
    handleNextStep2,
    handleSubmit,
    goToStep: setStep,
  };
}
