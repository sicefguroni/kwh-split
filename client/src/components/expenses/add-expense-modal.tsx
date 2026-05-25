import { Fragment, useEffect, useState } from "react";
import { X, ArrowLeft, Lock, Unlock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { type AddExpenseModalProps, type MemberSplitInput, type SplitType, type Category } from "./types";
import { useExpenseForm } from "./use-expense-form";
import { ReceiptUploadZone } from "./receipt-upload-zone";
import { receiptApi, type ReceiptItem } from "@/features/expenses/receipt-api";

const CATEGORY_OPTIONS = [
  { label: "Accommodation", value: "Accommodation" },
  { label: "Activities", value: "Activities" },
  { label: "Food", value: "Food" },
  { label: "Groceries", value: "Groceries" },
  { label: "General", value: "General" },
  { label: "Rent", value: "Rent" },
  { label: "School Requirements", value: "School Requirements" },
  { label: "Subscriptions", value: "Subscriptions" },
  { label: "Transportation", value: "Transportation" },
  { label: "Travel", value: "Travel" },
  { label: "Utilities", value: "Utilities" },
  { label: "Other", value: "Other" },
] as const satisfies ReadonlyArray<{ label: string; value: Category }>;

const SPLIT_TYPE_OPTIONS = [
  { label: "Split equally", value: "equal" },
  { label: "Split by percentage", value: "percentage" },
  { label: "Split by shares", value: "shares" },
  { label: "Split by exact amounts", value: "exact" },
  { label: "Split by item", value: "itemized" },
] as const satisfies ReadonlyArray<{ label: string; value: SplitType }>;

// =============================================================================
// Component
// =============================================================================

export function AddExpenseModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  members,
  currency,
  groupName,
}: AddExpenseModalProps) {
  const [ocrItems, setOcrItems] = useState<ReceiptItem[]>([]);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<{ file: File; preview: string } | null>(null);
  const [manualItems, setManualItems] = useState<Array<{ name: string; price: string }>>([]);
  const [isItemsMode, setIsItemsMode] = useState(false);
  const [itemAssignments, setItemAssignments] = useState<Record<number, string[]>>({});

  const handleExpenseSubmit = async (expense: Parameters<AddExpenseModalProps["onSubmit"]>[0]) => {
    if (expense.splitType !== "itemized") {
      const validItems = manualItems.filter((item) => item.name.trim() && parseFloat(item.price) > 0);
      if (validItems.length > 0) {
        expense.receiptItems = validItems.map((item, idx) => ({
          id: `item-${idx}`,
          itemName: item.name.trim(),
          price: parseFloat(item.price),
          assignedUserIds: [],
        }));
      }
    }
    await onSubmit(expense);
  };

  const form = useExpenseForm({
    isOpen,
    initialData,
    members,
    currency,
    onSubmit: handleExpenseSubmit,
    manualItems,
    itemAssignments,
  });
  const {
    step,
    expenseName, setExpenseName,
    amount, setAmount,
    payers, setPayers,
    date, setDate,
    note, setNote,
    category, setCategory,
    splitType, setSplitType,
    memberSplitInputs, updateMemberSplitInput,
    updateExactAmount,
    updateMemberDiscountType,
    toggleMemberLock,
    toggleMemberSelected,
    rebalancePercentageAllocations,
    totalAmount,
    computedSplits,
    error,
    handleNextStep1,
    handleNextStep2,
    handleSubmit,
    goToStep,
  } = form;
  const rebalanceExactAllocations: () => void =
    "rebalanceExactAllocations" in form
      ? (form as { rebalanceExactAllocations: () => void }).rebalanceExactAllocations
      : () => undefined;

  const handleOcrUpload = async (file: File) => {
    setOcrLoading(true);
    setOcrError(null);

    try {
      const preview = await receiptApi.fileToDataURL(file);
      const items = await receiptApi.previewReceipt(file);
      
      setReceiptFile({ file, preview });
      setOcrItems(items);
      setIsItemsMode(true);
      setManualItems(items.map((item) => ({ name: item.itemName, price: item.price.toFixed(2) })));

      if (items.length > 0) {
        const total = items.reduce((sum, item) => sum + item.price, 0);
        setAmount(total.toFixed(2));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to extract receipt";
      setOcrError(message);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleClearReceipt = () => {
    setReceiptFile(null);
    setOcrItems([]);
    setOcrError(null);
  };

  const addManualItem = () => {
    setManualItems((prev) => [...prev, { name: "", price: "" }]);
  };

  const updateManualItem = (index: number, field: "name" | "price", value: string) => {
    setManualItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index]!, [field]: value };
      const total = next.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
      setAmount(total > 0 ? total.toFixed(2) : "");
      return next;
    });
  };

  const removeManualItem = (index: number) => {
    setManualItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      const total = next.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
      setAmount(total > 0 ? total.toFixed(2) : "");
      return next;
    });
  };

  const toggleItemsMode = () => {
    if (isItemsMode) {
      setIsItemsMode(false);
      setManualItems([]);
      setItemAssignments({});
    } else {
      setIsItemsMode(true);
      if (manualItems.length === 0) {
        setManualItems([{ name: "", price: "" }]);
      }
    }
  };

  const hasValidItems = manualItems.some(
    (item) => item.name.trim() && parseFloat(item.price) > 0,
  );

  useEffect(() => {
    if (!isOpen) return;
    if (!initialData?.receiptItems?.length) {
      if (!isItemsMode) {
        setManualItems([]);
        setItemAssignments({});
      }
      return;
    }
    setIsItemsMode(true);
    setManualItems(
      initialData.receiptItems.map((item) => ({
        name: item.itemName,
        price: item.price.toFixed(2),
      })),
    );
    const assignments: Record<number, string[]> = {};
    initialData.receiptItems.forEach((item, idx) => {
      if (item.assignedUserIds?.length) {
        assignments[idx] = item.assignedUserIds;
      }
    });
    setItemAssignments(assignments);
  }, [isOpen, initialData]);

  useEffect(() => {
    if (!isItemsMode && splitType === "itemized") {
      setSplitType("equal");
    }
  }, [isItemsMode]);

  const splitTypeOptions = SPLIT_TYPE_OPTIONS.map((opt) => ({
    ...opt,
    disabled: opt.value === "itemized" && !hasValidItems && !isItemsMode,
  }));

  if (!isOpen) return null;

  const isEditing = !!initialData;
  const title = isEditing ? "Edit Expense" : "Add Expense";
  const memberOptions = members.map((member) => ({ label: member.name, value: member.id }));

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center p-0 sm:items-center sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink-900/65 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative flex h-full min-h-dvh w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:min-h-0 sm:max-h-[calc(100dvh-2rem)] sm:max-w-lg sm:rounded-4xl">

        {/* Mobile: back arrow + label, absolute over hero */}
        <div className="absolute left-4 top-4 z-20 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white sm:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <p className="text-xs font-medium uppercase tracking-[0.32em] text-white/70 sm:hidden">
            {title}
          </p>
        </div>

        {/* Desktop: X close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close expense modal"
          className="absolute right-4 top-4 z-20 hidden h-10 w-10 items-center justify-center rounded-full bg-white/92 text-slate-900 shadow-lg shadow-slate-950/15 transition hover:bg-white sm:inline-flex"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Hero: group name (dark) + expense title (blue) — replaces cover photo */}
        <div className="shrink-0">
          <div className="bg-ink-900 px-6 pt-14 pb-4 sm:pt-12">
            <p className="hidden text-xs font-medium uppercase tracking-[0.32em] text-white/70 sm:block">
              {title}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-white/40">
              {groupName}
            </p>
          </div>
         
        </div>

        {/* Step indicators */}
        <div className="flex shrink-0 items-center justify-center gap-2 px-6 py-4">
          {[1, 2, 3].map((s, i) => (
            <Fragment key={s}>
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors",
                  step >= s ? "bg-ink-900 text-white shadow-md" : "bg-slate-100 text-slate-400",
                )}
              >
                {s}
              </div>
              {i < 2 && (
                <div
                  className={cn(
                    "h-1 w-10 rounded-full transition-colors",
                    step > s ? "bg-ink-900" : "bg-slate-200",
                  )}
                />
              )}
            </Fragment>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="relative flex flex-1 flex-col overflow-y-auto px-6 pb-6">
          {/* OCR processing overlay */}
          {ocrLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/80 backdrop-blur-[2px]">
              <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-slate-200 border-t-slate-800" />
              <p className="text-sm font-semibold text-slate-800">Scanning receipt...</p>
              <p className="text-xs text-slate-500">This may take a few seconds</p>
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* Step 1 — Expense Info                                           */}
          {/* ---------------------------------------------------------------- */}
          {step === 1 && (
            <form
              onSubmit={(e) => { e.preventDefault(); handleNextStep1(); }}
              className="flex flex-1 flex-col gap-4"
            >
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Receipt (optional) <span className="font-normal text-slate-400">OCR will auto-fill amount</span>
                  </label>
                </div>
                <ReceiptUploadZone
                  onUpload={handleOcrUpload}
                  isLoading={ocrLoading}
                  error={ocrError ?? undefined}
                  preview={receiptFile ? { file: receiptFile.file, preview: receiptFile.preview } : undefined}
                  onClear={handleClearReceipt}
                />
                {ocrItems.length > 0 && (
                  <div className="rounded-lg bg-blue-50 p-3 text-sm">
                    <p className="font-semibold text-blue-900">{ocrItems.length} items extracted</p>
                    <p className="text-xs text-blue-700 mt-1">
                      Total: {currency} {ocrItems.reduce((sum, item) => sum + item.price, 0).toFixed(2)}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Expense name
                </label>
                <Input
                  placeholder="e.g. Dinner, Taxi, Groceries"
                  aria-label="Expense name"
                  value={expenseName}
                  onChange={(e) => setExpenseName(e.target.value)}
                  className="border-slate-200 bg-slate-50"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">
                  {isItemsMode ? "Items" : "Total amount"}
                </label>
                <div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isItemsMode}
                    aria-label={isItemsMode ? "Use items mode" : "Use single amount mode"}
                    onClick={toggleItemsMode}
                    className={cn(
                      "relative inline-grid h-10 w-48 grid-cols-2 items-center rounded-full bg-slate-200 p-1 text-[1opx] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400/20",
                    )}
                  >
                    <span
                      className={cn(
                        "relative z-10 text-center text-[10px] transition-colors",
                        isItemsMode ? "text-slate-500" : "text-transparent",
                      )}
                    >
                      By amount
                    </span>
                    <span
                      className={cn(
                        "relative z-10 text-center text-[10px] transition-colors",
                        isItemsMode ? "text-transparent" : "text-slate-500",
                      )}
                    >
                      By items
                    </span>
                    <span
                      className="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-sm transition-transform duration-200"
                      style={{ transform: isItemsMode ? "translateX(100%)" : "translateX(0)" }}
                    />
                    <span
                      className="pointer-events-none absolute inset-y-1 left-1 flex w-[calc(50%-0.25rem)] items-center justify-center text-[10px] font-semibold text-slate-900 transition-transform duration-200"
                      style={{ transform: isItemsMode ? "translateX(100%)" : "translateX(0)" }}
                    >
                      {isItemsMode ? "By items" : "By amount"}
                    </span>
                  </button>
                </div>
              </div>

              {isItemsMode ? (
                <div className="space-y-2">
                  {manualItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        placeholder="Item name"
                        value={item.name}
                        onChange={(e) => updateManualItem(index, "name", e.target.value)}
                        className="flex-1 h-10 border-slate-200 bg-slate-50 text-sm"
                      />
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={item.price}
                        onChange={(e) => updateManualItem(index, "price", e.target.value)}
                        className="w-24 h-10 border-slate-200 bg-slate-50 text-sm font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => removeManualItem(index)}
                        className="p-1.5 text-slate-400 hover:text-red-500"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addManualItem}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add item
                  </button>
                  <div className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2">
                    <span className="text-xs font-medium text-slate-500">Total</span>
                    <span className="text-sm font-bold text-slate-900">
                      {currency} {amount || "0.00"}
                    </span>
                  </div>
                </div>
              ) : (
                <Input
                  type="number"
                  placeholder="0.00"
                  aria-label="Total amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="border-slate-200 bg-slate-50 font-bold"
                />
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Date
                </label>
                <Input
                  type="date"
                  aria-label="Expense date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="border-slate-200 bg-slate-50"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-700">
                    Who paid?
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setPayers([...payers, { userId: members[0]?.id ?? "", amount: "" }]);
                    }}
                    className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    <Plus className="h-3 w-3" /> Add payer
                  </button>
                </div>
                <div className="space-y-2">
                  {payers.map((payer, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Select
                        value={payer.userId}
                        onValueChange={(value) => {
                          const next = [...payers];
                          next[idx] = { ...next[idx]!, userId: value };
                          setPayers(next);
                        }}
                        options={memberOptions}
                        ariaLabel={`Payer ${idx + 1}`}
                        placeholder="Select member"
                        triggerClassName="h-10 w-[160px] border-slate-200 bg-slate-50 text-sm text-slate-700 focus:ring-slate-400/20"
                        menuClassName="border-slate-200"
                      />
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                          {currency}
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={payer.amount}
                          onChange={(e) => {
                            const next = [...payers];
                            next[idx] = { ...next[idx]!, amount: e.target.value };
                            setPayers(next);
                          }}
                          className="h-10 w-28 border-slate-200 bg-slate-50 pl-7 text-right text-sm font-bold tabular-nums"
                        />
                      </div>
                      {payers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setPayers(payers.filter((_, i) => i !== idx));
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-500"
                          aria-label="Remove payer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2">
                  <span className="text-xs font-medium text-slate-500">
                    Total paid
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold tabular-nums text-slate-900">
                      {currency} {payers.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0).toFixed(2)}
                    </span>
                    {totalAmount > 0 && (
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        Math.abs(payers.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) - totalAmount) < 0.01
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700",
                      )}>
                        {Math.abs(payers.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) - totalAmount) < 0.01
                          ? "✓ Matches"
                          : `/ ${currency} ${totalAmount.toFixed(2)}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Category
                </label>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value as Category)}
                  options={[...CATEGORY_OPTIONS]}
                  ariaLabel="Category"
                  triggerClassName="h-12 border-slate-200 bg-slate-50 text-slate-700 focus:ring-slate-400/20"
                  menuClassName="border-slate-200"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Note <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  placeholder="What was this for?"
                  aria-label="Expense note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 disabled:opacity-70"
                />
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={ocrLoading}
                className="mt-auto w-full shrink-0 bg-ink-900 text-white hover:bg-ink-800 sm:mt-6"
              >
                {ocrLoading ? "Scanning receipt..." : "Next"}
              </Button>
            </form>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* Step 2 — Member selection                                       */}
          {/* ---------------------------------------------------------------- */}
          {step === 2 && (
            <form
              onSubmit={(e) => { e.preventDefault(); handleNextStep2(); }}
              className="flex flex-1 flex-col gap-4"
            >
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Split method
                </label>
                  <Select
                    value={splitType}
                    onValueChange={(value) => setSplitType(value as SplitType)}
                    options={splitTypeOptions}
                    ariaLabel="Split type"
                    triggerClassName="h-12 border-slate-200 bg-slate-50 text-slate-700 focus:ring-slate-400/20"
                    menuClassName="border-slate-200"
                  />
              </div>

              {splitType === "exact" ? (
                <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-500">
                    Lock members, then press Balance to distribute remaining among unlocked members.
                  </p>
                  <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={rebalanceExactAllocations}>
                    Balance
                  </Button>
                </div>
              ) : null}

              {splitType === "percentage" ? (
                <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-500">
                    Press Balance to normalize selected members to 100%.
                  </p>
                  <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={rebalancePercentageAllocations}>
                    Balance
                  </Button>
                </div>
              ) : null}

              {splitType === "itemized" ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-700">
                    Assign items to members
                  </p>
                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {manualItems.map((item, idx) => {
                      if (!item.name.trim() || parseFloat(item.price) <= 0) return null;
                      const assignedIds = itemAssignments[idx] ?? [];
                      return (
                        <div
                          key={idx}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-900">
                              {item.name}
                            </span>
                            <span className="text-sm font-bold text-slate-900">
                              {currency} {parseFloat(item.price).toFixed(2)}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {members.map((member) => (
                              <label
                                key={member.id}
                                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-white/60"
                              >
                                <input
                                  type="checkbox"
                                  checked={assignedIds.includes(member.id)}
                                  onChange={() => {
                                    setItemAssignments((prev) => {
                                      const current = [...(prev[idx] ?? [])];
                                      const pos = current.indexOf(member.id);
                                      if (pos > -1) {
                                        current.splice(pos, 1);
                                      } else {
                                        current.push(member.id);
                                      }
                                      return { ...prev, [idx]: current };
                                    });
                                  }}
                                  className="h-4 w-4 rounded border-slate-300 text-slate-900"
                                />
                                <span className="text-sm text-slate-700">{member.name}</span>
                              </label>
                            ))}
                          </div>
                          <div className="mt-2 flex gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                setItemAssignments((prev) => ({
                                  ...prev,
                                  [idx]: members.map((m) => m.id),
                                }))
                              }
                              className="text-xs font-medium text-blue-600 hover:text-blue-800"
                            >
                              Select all
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setItemAssignments((prev) => ({
                                  ...prev,
                                  [idx]: [],
                                }))
                              }
                              className="text-xs font-medium text-slate-500 hover:text-slate-700"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-2.5">
                    <span className="text-xs font-medium text-blue-900">Items with assignments</span>
                    <span className="text-xs text-blue-700">
                      {manualItems.filter((i, idx) => i.name.trim() && parseFloat(i.price) > 0 && (itemAssignments[idx]?.length ?? 0) > 0).length}
                      {" "}/{" "}
                      {manualItems.filter((i) => i.name.trim() && parseFloat(i.price) > 0).length}
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-700">Member allocations</p>
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {members.map((member) => {
                      const splitInput = memberSplitInputs[member.id];
                      const isLocked =
                        (splitInput as MemberSplitInput & { locked?: boolean } | undefined)?.locked ?? false;
                      return (
                        <div
                          key={member.id}
                          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                        >
                          <input
                            type="checkbox"
                            checked={splitInput?.selected ?? false}
                            onChange={(e) => toggleMemberSelected(member.id, e.target.checked)}
                            aria-label={`Include ${member.name} in split`}
                            className="h-5 w-5 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                          />
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="text-sm font-semibold text-slate-900">{member.name}</span>
                            {splitInput?.selected ? (
                              <Select
                                value={splitInput.discountType ?? "none"}
                                onValueChange={(value) =>
                                  updateMemberDiscountType(member.id, value as "none" | "pwd" | "senior")
                                }
                                options={[
                                  { label: "No discount", value: "none" },
                                  { label: "PWD (20%)", value: "pwd" },
                                  { label: "Senior (20%)", value: "senior" },
                                ]}
                                ariaLabel={`Discount type for ${member.name}`}
                                placeholder="No discount"
                                triggerClassName="mt-1 h-7 rounded-lg border border-slate-200 bg-white px-2 text-[11px] text-slate-600"
                                menuClassName="border-slate-200"
                              />
                            ) : null}
                          </div>

                          {splitInput?.selected && splitType === "equal" && (
                            <div className="flex w-28 items-center gap-1 text-right">
                              <span className="text-sm text-slate-500">{currency}</span>
                              <span className="flex-1 text-sm font-semibold tabular-nums text-slate-900">
                                {parseFloat(splitInput.amount || "0").toFixed(2)}
                              </span>
                            </div>
                          )}

                          {splitInput?.selected && (splitType === "exact" || splitType === "percentage") && (
                            <div className="flex w-40 items-center gap-2">
                              <button
                                type="button"
                                aria-label={isLocked ? `Unlock ${member.name}` : `Lock ${member.name}`}
                                className={cn(
                                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                                  isLocked
                                    ? "border-slate-400 bg-slate-200 text-slate-700"
                                    : "border-slate-200 bg-white text-slate-400",
                                )}
                                onClick={() => toggleMemberLock(member.id)}
                              >
                                {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                              </button>
                              <span className="w-5 text-sm text-slate-500">
                                {splitType === "exact" ? currency : "%"}
                              </span>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={splitInput.amount}
                                disabled={isLocked}
                                onChange={(e) => {
                                  if (splitType === "exact") { updateExactAmount(member.id, e.target.value); return; }
                                  updateMemberSplitInput(member.id, { amount: e.target.value });
                                }}
                                onBlur={(e) => {
                                  const formatted = e.target.value === "" ? "" : parseFloat(e.target.value).toFixed(2);
                                  if (splitType === "exact") { updateExactAmount(member.id, formatted); return; }
                                  updateMemberSplitInput(member.id, { amount: formatted });
                                }}
                                className="h-9 flex-1 border-slate-200 bg-white text-right text-sm tabular-nums"
                              />
                            </div>
                          )}

                          {splitInput?.selected && splitType === "shares" && (
                            <div className="flex w-32 items-center gap-2">
                              <Input
                                type="number"
                                step="1"
                                placeholder="0"
                                value={splitInput.amount}
                                onChange={(e) => updateMemberSplitInput(member.id, { amount: e.target.value })}
                                onBlur={(e) => {
                                  const formatted = e.target.value === "" ? "" : parseFloat(e.target.value).toFixed(2);
                                  updateMemberSplitInput(member.id, { amount: formatted });
                                }}
                                className="h-9 flex-1 border-slate-200 bg-white text-right text-sm tabular-nums"
                              />
                              <span className="text-xs text-slate-500">shares</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-auto flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => goToStep(1)} className="flex-1">
                  Back
                </Button>
                <Button type="submit" size="lg" className="flex-1 bg-ink-900 text-white hover:bg-ink-800">
                  Next
                </Button>
              </div>
            </form>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* Step 3 — Confirm                                                */}
          {/* ---------------------------------------------------------------- */}
          {step === 3 && (
            <form
              onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}
              className="flex flex-1 flex-col gap-4"
            >
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Expense</p>
                <div className="mt-1 flex items-end justify-between gap-2">
                  <p className="text-lg font-bold text-slate-900">{expenseName}</p>
                  <p className="text-2xl font-black text-slate-900">
                    {currency} {totalAmount.toFixed(2)}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold text-slate-700">Split details</p>
                <div className="space-y-2">
                  {members
                    .filter((member) => (computedSplits[member.id] ?? 0) > 0)
                    .map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                            {member.name[0]}
                          </div>
                          <span className="text-sm font-medium text-slate-700">
                            {member.name}
                            {(memberSplitInputs[member.id]?.discountType ?? "none") !== "none"
                              ? ` (${memberSplitInputs[member.id]?.discountType?.toUpperCase()} 20%)`
                              : ""}
                          </span>
                        </div>
                        <span className="text-sm font-bold tabular-nums text-slate-900">
                          {currency} {computedSplits[member.id]!.toFixed(2)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="mt-auto flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => goToStep(2)} className="flex-1">
                  Back
                </Button>
                <Button type="submit" size="lg" className="flex-1 bg-ink-900 text-white hover:bg-ink-800 sm:mt-0">
                  {isEditing ? "Save Changes" : "Add Expense"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

