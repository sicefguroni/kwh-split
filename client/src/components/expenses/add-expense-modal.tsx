import { Fragment } from "react";
import { X, AlertCircle, ChevronLeft, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { type AddExpenseModalProps, type SplitType } from "./types";
import { useExpenseForm } from "./use-expense-form";

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
  const {
    step,
    expenseName, setExpenseName,
    amount, setAmount,
    paidBy, setPaidBy,
    date, setDate,
    note,
    splitType, setSplitType,
    memberSplitInputs, updateMemberSplitInput,
    totalAmount,
    computedSplits,
    error,
    handleNextStep1,
    handleNextStep2,
    handleSubmit,
    goToStep,
  } = useExpenseForm({ isOpen, initialData, members, currency, onSubmit });

  if (!isOpen) return null;

  const title = initialData ? "Edit Expense" : "Add Expense";
  const memberOptions = members.map((member) => ({ label: member.name, value: member.id }));

  return (
    /* Full-screen on mobile, centred modal on md+ */
    <div className="fixed inset-0 z-50 flex flex-col md:items-center md:justify-center md:p-4">
      {/* Desktop backdrop */}
      <div
        className="hidden md:block absolute inset-0 bg-ink-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel — full screen mobile / rounded modal desktop */}
      <div className="relative flex flex-col w-full h-full md:h-auto md:max-w-md md:rounded-3xl md:overflow-hidden md:shadow-2xl bg-mint-100 md:border md:border-mint-200 animate-in fade-in md:zoom-in-95 duration-200">

        {/* ---------------------------------------------------------------- */}
        {/* Mobile: back-arrow header                                        */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex items-center px-4 pt-5 pb-0 md:hidden">
          <button
            type="button"
            onClick={onClose}
            aria-label="Go back"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-900 hover:bg-mint-200 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="flex-1 text-center text-base font-bold text-ink-900">{title}</h2>
          <div className="h-9 w-9" aria-hidden />
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Desktop: X close + title                                         */}
        {/* ---------------------------------------------------------------- */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close expense modal"
          className="hidden md:flex absolute right-4 top-4 z-10 h-8 w-8 items-center justify-center rounded-full bg-white/50 text-ink-900 hover:bg-white/80 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="hidden md:block text-center text-lg font-bold text-ink-900 pt-6">
          {title}
        </h2>

        {/* ---------------------------------------------------------------- */}
        {/* Progress steps                                                   */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex items-center justify-center gap-2 py-5 px-6">
          {[1, 2, 3].map((s, i) => (
            <Fragment key={s}>
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
                  step >= s ? "bg-[#1b6391] text-white shadow-md" : "bg-mint-200 text-mint-500",
                )}
              >
                {s}
              </div>
              {i < 2 && (
                <div
                  className={cn(
                    "h-1 w-10 rounded-full transition-colors",
                    step > s ? "bg-[#1b6391]" : "bg-mint-200",
                  )}
                />
              )}
            </Fragment>
          ))}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Card header: group name (dark) + expense title (blue)            */}
        {/* ---------------------------------------------------------------- */}
        <div className="mx-5 mb-4 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-ink-900 text-white text-center py-3 font-bold uppercase tracking-widest text-sm">
            {groupName}
          </div>
          <div className="bg-[#0074B7] py-3 px-4">
            {step === 1 ? (
              <input
                type="text"
                placeholder="expense title"
                aria-label="Expense name"
                value={expenseName}
                onChange={(e) => setExpenseName(e.target.value)}
                className="w-full bg-transparent text-center text-white text-sm font-semibold placeholder:text-white/60 focus:outline-none"
              />
            ) : (
              <p className="text-center text-white text-sm font-semibold truncate px-2">
                {expenseName || "expense title"}
              </p>
            )}
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Scrollable body                                                  */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex-1 overflow-y-auto px-5 pb-8 flex flex-col gap-3 md:pb-6">

          {error && (
            <div className="flex items-center gap-2 text-danger bg-danger/10 p-3 rounded-xl text-sm font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* -------------------------------------------------------------- */}
          {/* Step 1 — Expense Info                                          */}
          {/* -------------------------------------------------------------- */}
          {step === 1 && (
            <form
              onSubmit={(e) => { e.preventDefault(); handleNextStep1(); }}
              className="flex flex-col gap-3 flex-1"
            >
              {/* Total amount */}
              <Input
                type="number"
                placeholder="Total amount"
                aria-label="Total amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-12 rounded-2xl border-0 bg-white shadow-sm font-bold text-ink-900 placeholder:text-ink-300 placeholder:font-normal focus:ring-2 focus:ring-[#0074B7]/20"
              />

              {/* Paid by */}
              <Select
                value={paidBy}
                onValueChange={setPaidBy}
                options={[
                  { label: "Paid by", value: "", disabled: true },
                  ...memberOptions,
                ]}
                ariaLabel="Paid by"
                placeholder="Paid by"
                triggerClassName="border-0 bg-white text-ink-900 focus:ring-[#0074B7]/20"
                menuClassName="border-mint-200"
              />

              {/* Date */}
              <div className="relative">
                <input
                  type="date"
                  aria-label="Expense date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="appearance-none w-full h-12 rounded-2xl border-0 bg-white shadow-sm px-4 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#0074B7]/20 text-ink-900"
                />
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0074B7]" />
              </div>

              {/* Split type */}
              <Select
                value={splitType}
                onValueChange={(value) => setSplitType(value as SplitType)}
                options={[...SPLIT_TYPE_OPTIONS]}
                ariaLabel="Split type"
                triggerClassName="border-0 bg-white text-ink-900 focus:ring-[#0074B7]/20"
                menuClassName="border-mint-200"
              />

              <div className="mt-auto pt-3">
                <Button
                  type="submit"
                  className="w-full h-12 rounded-full bg-[#5ba3c9] hover:bg-[#4a8fb8] text-white font-semibold text-base shadow-sm border-0"
                >
                  Next
                </Button>
              </div>
            </form>
          )}

          {/* -------------------------------------------------------------- */}
          {/* Step 2 — Member selection                                      */}
          {/* -------------------------------------------------------------- */}
          {step === 2 && (
            <form
              onSubmit={(e) => { e.preventDefault(); handleNextStep2(); }}
              className="flex flex-col gap-3 flex-1"
            >
              <div className="text-xs font-bold text-ink-500 uppercase px-1">
                Select who is involved
              </div>

              <div className="flex-1 overflow-y-auto max-h-80 space-y-2 pr-1">
                {members.map((member) => {
                  const splitInput = memberSplitInputs[member.id];
                  return (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-ink-100 bg-white"
                    >
                      <input
                        type="checkbox"
                        checked={splitInput?.selected ?? false}
                        onChange={(e) =>
                          updateMemberSplitInput(member.id, { selected: e.target.checked })
                        }
                        aria-label={`Include ${member.name} in split`}
                        className="h-5 w-5 rounded border-ink-300 text-mint-600 focus:ring-mint-600"
                      />
                      <div className="flex items-center gap-2 flex-1">
                        <div className="h-8 w-8 rounded-full bg-mint-100 text-mint-700 flex items-center justify-center text-xs font-bold">
                          {member.name[0]}
                        </div>
                        <span className="font-semibold text-sm">{member.name}</span>
                      </div>

                      {splitInput?.selected && splitType === "equal" && (
                        <div className="flex items-center gap-2 w-32">
                          <span className="text-sm font-medium text-ink-500 w-6">{currency}</span>
                          <span className="flex-1 h-8 px-2 text-right text-sm font-medium text-ink-900">
                            {parseFloat(splitInput.amount || "0").toFixed(2)}
                          </span>
                        </div>
                      )}

                      {splitInput?.selected && splitType === "exact" && (
                        <div className="flex items-center gap-2 w-32">
                          <span className="text-sm font-medium text-ink-500 w-6">{currency}</span>
                          <Input
                            type="number"
                            step="0.01"
                            className="h-8 px-2 text-right text-sm flex-1"
                            placeholder="0.00"
                            value={splitInput.amount}
                            onChange={(e) => updateMemberSplitInput(member.id, { amount: e.target.value })}
                            onBlur={(e) => {
                              const formatted = e.target.value === "" ? "" : parseFloat(e.target.value).toFixed(2);
                              updateMemberSplitInput(member.id, { amount: formatted });
                            }}
                          />
                        </div>
                      )}

                      {splitInput?.selected && splitType !== "equal" && splitType !== "exact" && (
                        <div className="flex items-center gap-2 w-32">
                          <Input
                            type="number"
                            step={splitType === "percentage" ? "0.01" : "1"}
                            className="h-8 px-2 text-right text-sm flex-1"
                            placeholder="0"
                            value={splitInput.amount}
                            onChange={(e) => updateMemberSplitInput(member.id, { amount: e.target.value })}
                            onBlur={(e) => {
                              const formatted = e.target.value === "" ? "" : parseFloat(e.target.value).toFixed(2);
                              updateMemberSplitInput(member.id, { amount: formatted });
                            }}
                          />
                          <span className="text-sm font-medium text-ink-500 w-10">
                            {splitType === "percentage" ? "%" : "shares"}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-auto pt-3 flex justify-between gap-3">
                <Button type="button" variant="secondary" onClick={() => goToStep(1)} className="flex-1">
                  Back
                </Button>
                <Button type="submit" className="flex-1 bg-[#5ba3c9] hover:bg-[#4a8fb8] text-white border-0">
                  Next
                </Button>
              </div>
            </form>
          )}

          {/* -------------------------------------------------------------- */}
          {/* Step 3 — Confirm                                               */}
          {/* -------------------------------------------------------------- */}
          {step === 3 && (
            <form
              onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
              className="flex flex-col gap-4 flex-1"
            >
              <div className="bg-white p-4 rounded-2xl flex items-center justify-between shadow-sm">
                <div>
                  <div className="text-xs text-ink-500 font-semibold uppercase">Total Expense</div>
                  <div className="font-bold text-xl text-ink-900">{expenseName}</div>
                </div>
                <div className="text-2xl font-black text-[#0074B7]">
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
                        <span className="font-medium text-ink-700">{member.name}</span>
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

