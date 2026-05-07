import { Fragment } from "react";
import { X, AlertCircle, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { type AddExpenseModalProps, type MemberSplitInput, type SplitType } from "./types";
import { useExpenseForm } from "./use-expense-form";

// =============================================================================
// Constants
// =============================================================================

const STEP_LABELS: Record<number, string> = {
  1: "Expense Info",
  2: "Split Method",
  3: "Confirm",
};

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
}: AddExpenseModalProps) {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative my-2 w-full max-w-md max-h-[95vh] overflow-y-auto rounded-3xl bg-mint-50 shadow-2xl animate-in fade-in zoom-in-95 duration-200 border border-mint-100 sm:my-0">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close expense modal"
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/50 text-ink-900 hover:bg-white/80"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="p-6 pb-0">
          <h2 className="text-center text-lg font-bold text-mint-700 mb-6">
            {initialData ? "Edit Expense" : "Add Expense"}
          </h2>

          {/* Progress steps */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {[1, 2, 3].map((s, i) => (
              <Fragment key={s}>
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
                    step >= s ? "bg-mint-600 text-white shadow-md" : "bg-mint-200 text-mint-500",
                  )}
                >
                  {s}
                </div>
                {i < 2 && (
                  <div
                    className={cn(
                      "h-1 w-8 rounded-full transition-colors",
                      step > s ? "bg-mint-600" : "bg-mint-200",
                    )}
                  />
                )}
              </Fragment>
            ))}
          </div>

          <div className="bg-ink-900 text-white text-center py-2 rounded-t-xl font-bold uppercase tracking-widest text-sm">
            {currency}
          </div>
          <div className="bg-[#0074B7] text-white text-center py-2 rounded-b-xl text-xs font-semibold mb-6">
            {STEP_LABELS[step]}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 pt-2 bg-white rounded-t-3xl min-h-75 flex flex-col">
          {error && (
            <div className="mb-4 flex items-center gap-2 text-danger bg-danger/10 p-3 rounded-lg text-sm font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* Step 1 — Expense Info                                            */}
          {/* ---------------------------------------------------------------- */}
          {step === 1 && (
            <form
              onSubmit={(e) => { e.preventDefault(); handleNextStep1(); }}
              className="flex flex-col gap-4 flex-1"
            >
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500 px-1">
                Expense name
              </label>
              <Input
                placeholder="Expense Name"
                aria-label="Expense name"
                value={expenseName}
                onChange={(e) => setExpenseName(e.target.value)}
                className="bg-mint-50 border-mint-200"
              />
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500 px-1">
                Total amount
              </label>
              <Input
                type="number"
                placeholder="Amount"
                aria-label="Expense amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-mint-50 border-mint-200 font-bold"
              />
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500 px-1">
                Paid by
              </label>
              <select
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                aria-label="Paid by"
                className="h-12 w-full rounded-xl border border-mint-200 bg-mint-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-mint-500/20"
              >
                <option value="" disabled>Paid By</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500 px-1">
                Date
              </label>
              <Input
                type="date"
                aria-label="Expense date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-mint-50 border-mint-200"
              />
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500 px-1">
                Note
              </label>
              <textarea
                placeholder="Note (optional)"
                aria-label="Expense note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-mint-200 bg-mint-50 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-mint-500/20"
              />
              <div className="mt-auto pt-4 flex justify-end">
                <Button type="submit" className="w-full sm:w-auto bg-mint-600 hover:bg-mint-700">
                  Next
                </Button>
              </div>
            </form>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* Step 2 — Split Method                                            */}
          {/* ---------------------------------------------------------------- */}
          {step === 2 && (
            <form
              onSubmit={(e) => { e.preventDefault(); handleNextStep2(); }}
              className="flex flex-col gap-3 flex-1"
            >
              <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-ink-500 uppercase">Split method</label>
                <select
                  value={splitType}
                  onChange={(e) => setSplitType(e.target.value as SplitType)}
                  aria-label="Split type"
                  className="flex-1 h-9 rounded-lg border border-mint-200 bg-mint-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-mint-500/20 font-medium"
                >
                  <option value="equal">Split equally</option>
                  <option value="percentage">Split by percentage</option>
                  <option value="shares">Split by shares</option>
                  <option value="exact">Split by exact amounts</option>
                </select>
              </div>

              <div className="text-xs font-bold text-ink-500 uppercase px-2">
                Member allocations
              </div>

              {splitType === "exact" ? (
                <div className="px-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-ink-500">
                    Lock members, then press Balance Amounts to distribute remaining amount among unlocked members.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onClick={rebalanceExactAllocations}
                  >
                    Balance Amounts
                  </Button>
                </div>
              ) : null}
              {splitType === "percentage" ? (
                <div className="px-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-ink-500">
                    Press Balance Percentages to normalize selected members to 100%.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onClick={rebalancePercentageAllocations}
                  >
                    Balance Percentages
                  </Button>
                </div>
              ) : null}

              <div className="flex-1 overflow-y-auto max-h-64 space-y-2 pr-2">
                {members.map((member) => {
                  const splitInput = memberSplitInputs[member.id];
                  const isLocked =
                    (splitInput as MemberSplitInput & { locked?: boolean } | undefined)?.locked ??
                    false;
                  return (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-ink-100 bg-white"
                    >
                      <input
                        type="checkbox"
                        checked={splitInput?.selected ?? false}
                        onChange={(e) =>
                          toggleMemberSelected(member.id, e.target.checked)
                        }
                        aria-label={`Include ${member.name} in split`}
                        className="h-5 w-5 rounded border-ink-300 text-mint-600 focus:ring-mint-600"
                      />
                      <div className="flex items-center gap-2 flex-1">
                        <div className="h-8 w-8 rounded-full bg-mint-100 text-mint-700 flex items-center justify-center text-xs font-bold">
                          {member.name[0]}
                        </div>
                        <div className="flex min-w-0 flex-col">
                          <span className="font-semibold text-sm">{member.name}</span>
                          {splitInput?.selected ? (
                            <select
                              value={splitInput.discountType ?? "none"}
                              onChange={(e) =>
                                updateMemberDiscountType(
                                  member.id,
                                  e.target.value as "none" | "pwd" | "senior",
                                )
                              }
                              className="mt-1 h-7 rounded border border-ink-200 bg-white px-2 text-[11px] text-ink-600"
                              aria-label={`Discount type for ${member.name}`}
                            >
                              <option value="none">No discount</option>
                              <option value="pwd">PWD (20%)</option>
                              <option value="senior">Senior (20%)</option>
                            </select>
                          ) : null}
                        </div>
                      </div>

                      {/* Equal — read-only */}
                      {splitInput?.selected && splitType === "equal" && (
                        <div className="flex items-center gap-2 w-32">
                          <span className="text-sm font-medium text-ink-500 w-6">{currency}</span>
                          <div className="flex-1">
                            <span className="block h-8 px-2 text-right text-sm font-medium text-ink-900">
                              {parseFloat(splitInput.amount || "0").toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Exact / Percentage with lock support */}
                      {splitInput?.selected && (splitType === "exact" || splitType === "percentage") && (
                        <div className="flex items-center gap-2 w-44">
                          <button
                            type="button"
                            aria-label={isLocked ? `Unlock ${member.name}` : `Lock ${member.name}`}
                            title={isLocked ? "Unlock amount" : "Lock amount"}
                            className={cn(
                              "h-9 w-9 rounded-lg border flex items-center justify-center",
                              isLocked
                                ? "border-mint-600 bg-mint-100 text-mint-700"
                                : "border-ink-200 bg-white text-ink-500",
                            )}
                            onClick={() =>
                              toggleMemberLock(member.id)
                            }
                          >
                            {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                          </button>
                          <span className="text-sm font-medium text-ink-500 w-6">
                            {splitType === "exact" ? currency : "%"}
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            className="h-10 px-3 text-right text-base tabular-nums flex-1"
                            placeholder="0.00"
                            value={splitInput.amount}
                            disabled={isLocked}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (splitType === "exact") {
                                updateExactAmount(member.id, value);
                                return;
                              }
                              updateMemberSplitInput(member.id, { amount: value });
                            }}
                            onBlur={(e) => {
                              const formatted =
                                e.target.value === "" ? "" : parseFloat(e.target.value).toFixed(2);
                              if (splitType === "exact") {
                                updateExactAmount(member.id, formatted);
                                return;
                              }
                              updateMemberSplitInput(member.id, { amount: formatted });
                            }}
                          />
                        </div>
                      )}

                      {/* Percentage / Shares — unit-labelled input */}
                      {splitInput?.selected && splitType === "shares" && (
                        <div className="flex items-center gap-2 w-44">
                          <Input
                            type="number"
                            step="1"
                            className="h-10 px-3 text-right text-base tabular-nums flex-1"
                            placeholder="0"
                            value={splitInput.amount}
                            onChange={(e) => {
                              const value = e.target.value;
                              // Update input immediately
                              updateMemberSplitInput(member.id, { amount: value });
                            }}
                            onBlur={(e) => {
                              const formatted =
                                e.target.value === "" ? "" : parseFloat(e.target.value).toFixed(2);
                              updateMemberSplitInput(member.id, { amount: formatted });
                            }}
                          />
                          <span className="text-sm font-medium text-ink-500 w-12 text-right">
                            shares
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-auto pt-4 flex justify-between gap-3">
                <Button type="button" variant="secondary" onClick={() => goToStep(1)} className="flex-1">
                  Back
                </Button>
                <Button type="submit" className="flex-1 bg-mint-600 hover:bg-mint-700">
                  Next
                </Button>
              </div>
            </form>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* Step 3 — Confirm                                                 */}
          {/* ---------------------------------------------------------------- */}
          {step === 3 && (
            <form
              onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
              className="flex flex-col gap-4 flex-1"
            >
              <div className="bg-mint-50 p-4 rounded-xl flex items-center justify-between mb-2">
                <div>
                  <div className="text-xs text-ink-500 font-semibold uppercase">Total Expense</div>
                  <div className="font-bold text-xl text-ink-900">{expenseName}</div>
                </div>
                <div className="text-2xl font-black text-mint-600">
                  {currency} {totalAmount.toFixed(2)}
                </div>
              </div>

              {note.trim() && (
                <p className="text-xs text-ink-500 italic px-1">{note.trim()}</p>
              )}

              <div className="space-y-3">
                <div className="text-xs font-bold text-ink-500 uppercase">Split Details</div>
                {members
                  .filter((member) => (computedSplits[member.id] ?? 0) > 0)
                  .map((member) => (
                    <div key={member.id} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-ink-100 flex items-center justify-center text-[10px] font-bold text-ink-600">
                          {member.name[0]}
                        </div>
                        <span className="font-medium text-ink-700">
                          {member.name}
                          {(memberSplitInputs[member.id]?.discountType ?? "none") !== "none"
                            ? ` (${memberSplitInputs[member.id]?.discountType?.toUpperCase()} 20%)`
                            : ""}
                        </span>
                      </div>
                      <span className="font-bold text-ink-900">
                        {currency} {computedSplits[member.id]!.toFixed(2)}
                      </span>
                    </div>
                  ))}
              </div>

              <div className="mt-auto pt-4 flex justify-between gap-3">
                <Button type="button" variant="secondary" onClick={() => goToStep(2)} className="flex-1">
                  Back
                </Button>
                <Button type="submit" className="flex-1 bg-ink-900 hover:bg-ink-800 text-white">
                  {initialData ? "Save Changes" : "Add Expense"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
