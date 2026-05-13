import { Fragment, useState } from "react";
import { X, ArrowLeft, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { type AddExpenseModalProps, type MemberSplitInput, type SplitType } from "./types";
import { useExpenseForm } from "./use-expense-form";
import { ReceiptUploadZone } from "./receipt-upload-zone";
import { receiptApi, type ReceiptItem } from "@/features/expenses/receipt-api";

const SPLIT_TYPE_OPTIONS = [
  { label: "Split equally", value: "equal" },
  { label: "Split by percentage", value: "percentage" },
  { label: "Split by shares", value: "shares" },
  { label: "Split by exact amounts", value: "exact" },
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

  const form = useExpenseForm({ isOpen, initialData, members, currency, onSubmit });
  const {
    step,
    expenseName, setExpenseName,
    amount, setAmount,
    paidBy, setPaidBy,
    date, setDate,
    note, setNote,
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

      // Auto-populate total amount from OCR items
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
        <div className="flex flex-1 flex-col overflow-y-auto px-6 pb-6">
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Total amount
                  </label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    aria-label="Total amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="border-slate-200 bg-slate-50 font-bold"
                  />
                </div>
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
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Paid by
                </label>
                <Select
                  value={paidBy}
                  onValueChange={setPaidBy}
                  options={[{ label: "Select member", value: "", disabled: true }, ...memberOptions]}
                  ariaLabel="Paid by"
                  placeholder="Select member"
                  triggerClassName="h-12 border-slate-200 bg-slate-50 text-slate-700 focus:ring-slate-400/20"
                  menuClassName="border-slate-200"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Split type
                </label>
                <Select
                  value={splitType}
                  onValueChange={(value) => setSplitType(value as SplitType)}
                  options={[...SPLIT_TYPE_OPTIONS]}
                  ariaLabel="Split type"
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
                className="mt-auto w-full shrink-0 bg-ink-900 text-white hover:bg-ink-800 sm:mt-6"
              >
                Next
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
                  options={[...SPLIT_TYPE_OPTIONS]}
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
                            <select
                              value={splitInput.discountType ?? "none"}
                              onChange={(e) =>
                                updateMemberDiscountType(member.id, e.target.value as "none" | "pwd" | "senior")
                              }
                              className="mt-1 h-7 rounded-lg border border-slate-200 bg-white px-2 text-[11px] text-slate-600"
                              aria-label={`Discount type for ${member.name}`}
                            >
                              <option value="none">No discount</option>
                              <option value="pwd">PWD (20%)</option>
                              <option value="senior">Senior (20%)</option>
                            </select>
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
              onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
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

              {note.trim() && (
                <p className="px-1 text-xs italic text-slate-500">{note.trim()}</p>
              )}

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

