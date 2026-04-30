import { useEffect, useState } from "react";
import { X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { type GroupExpense, type GroupMember } from "@/hooks/use-groups";

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (expense: GroupExpense) => void;
  initialData?: GroupExpense | undefined;
  members: GroupMember[];
  currency: string;
}

export function AddExpenseModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  members,
  currency,
}: AddExpenseModalProps) {
  const [step, setStep] = useState(1);
  const [expenseName, setExpenseName] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(members[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  const [splits, setSplits] = useState<Record<string, { selected: boolean; amount: string }>>(
    members.reduce((acc, member) => ({ ...acc, [member.id]: { selected: true, amount: "" } }), {}),
  );

  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    setExpenseName(initialData?.name ?? "");
    setAmount(initialData?.amount.toString() ?? "");
    setPaidBy(initialData?.paidBy ?? members[0]?.id ?? "");
    setDate(initialData?.date ?? new Date().toISOString().slice(0, 10));
    setNote(initialData?.note ?? "");
    setSplits(
      members.reduce((acc, member) => {
        const split = initialData?.splits.find((entry) => entry.memberId === member.id);
        return {
          ...acc,
          [member.id]: {
            selected: split ? split.amount > 0 : true,
            amount: split ? split.amount.toString() : "",
          },
        };
      }, {} as Record<string, { selected: boolean; amount: string }>),
    );
    setStep(initialData ? 3 : 1);
    setError("");
  }, [isOpen, initialData, members]);

  if (!isOpen) return null;

  const totalAmount = parseFloat(amount) || 0;

  const handleNextStep1 = () => {
    if (!expenseName || !amount) {
      setError("Please fill in the expense name and amount.");
      return;
    }
    setError("");
    
    // Default split equally
    const selectedCount = Object.values(splits).filter(s => s.selected).length;
    if (selectedCount > 0 && totalAmount > 0) {
      const splitAmt = (totalAmount / selectedCount).toFixed(2);
      const newSplits = { ...splits };
      for (const id in newSplits) {
        if (newSplits[id]?.selected) {
          newSplits[id] = { ...newSplits[id]!, amount: splitAmt };
        } else {
          newSplits[id] = { ...newSplits[id]!, amount: "0" };
        }
      }
      setSplits(newSplits);
    }
    
    setStep(2);
  };

  const handleNextStep2 = () => {
    // Validate split amount
    let sum = 0;
    for (const id in splits) {
      if (splits[id]?.selected) {
        sum += parseFloat(splits[id]!.amount) || 0;
      }
    }
    
    if (Math.abs(sum - totalAmount) > 0.01) {
      setError(`Split amounts do not match total. Total: ${totalAmount}, Sum: ${sum}`);
      return;
    }
    
    setError("");
    setStep(3);
  };

  const handleSubmit = () => {
    if (!expenseName.trim()) {
      setError("Expense name is required.");
      setStep(1);
      return;
    }

    if (totalAmount <= 0) {
      setError("Enter a valid amount.");
      setStep(1);
      return;
    }

    const expense: GroupExpense = {
      id: initialData?.id ?? `expense-${Math.random().toString(36).slice(2)}`,
      name: expenseName.trim(),
      amount: totalAmount,
      currency,
      paidBy,
      date,
      note: note.trim(),
      splits: Object.entries(splits)
        .filter(([, split]) => split.selected)
        .map(([memberId, split]) => ({ memberId, amount: parseFloat(split.amount) || 0 })),
      status: initialData?.status ?? "pending",
    };

    onSubmit(expense);
    setStep(1);
    setExpenseName("");
    setAmount("");
    setPaidBy(members[0]?.id ?? "");
    setDate(new Date().toISOString().slice(0, 10));
    setNote("");
    setError("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-mint-50 shadow-2xl animate-in fade-in zoom-in-95 duration-200 border border-mint-100">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close expense modal"
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/50 text-ink-900 hover:bg-white/80"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6 pb-0">
          <h2 className="text-center text-lg font-bold text-mint-700 mb-6">Add Expense</h2>
          
          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors", step >= 1 ? "bg-mint-600 text-white shadow-md" : "bg-mint-200 text-mint-500")}>1</div>
            <div className={cn("h-1 w-8 rounded-full transition-colors", step >= 2 ? "bg-mint-600" : "bg-mint-200")} />
            <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors", step >= 2 ? "bg-mint-600 text-white shadow-md" : "bg-mint-200 text-mint-500")}>2</div>
            <div className={cn("h-1 w-8 rounded-full transition-colors", step >= 3 ? "bg-mint-600" : "bg-mint-200")} />
            <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors", step >= 3 ? "bg-mint-600 text-white shadow-md" : "bg-mint-200 text-mint-500")}>3</div>
          </div>

          <div className="bg-ink-900 text-white text-center py-2 rounded-t-xl font-bold uppercase tracking-widest text-sm">
            {currency}
          </div>
          <div className="bg-[#0074B7] text-white text-center py-2 rounded-b-xl text-xs font-semibold mb-6">
            {step === 1 ? "Expense Info" : step === 2 ? "Split Method" : "Confirm"}
          </div>
        </div>

        <div className="px-6 pb-6 pt-2 bg-white rounded-t-3xl min-h-75 flex flex-col">
          {error && (
            <div className="mb-4 flex items-center gap-2 text-danger bg-danger/10 p-3 rounded-lg text-sm font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-4 flex-1">
              <Input
                placeholder="Expense Name"
                aria-label="Expense name"
                value={expenseName}
                onChange={(e) => setExpenseName(e.target.value)}
                className="bg-mint-50 border-mint-200"
              />
              <Input
                type="number"
                placeholder="Amount"
                aria-label="Expense amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-mint-50 border-mint-200 font-bold"
              />
              <div className="flex items-center gap-2">
                <select
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                  aria-label="Paid by"
                  className="flex-1 h-12 rounded-xl border border-mint-200 bg-mint-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-mint-500/20"
                >
                  <option value="" disabled>Paid By</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </div>
              <Input
                type="date"
                aria-label="Expense date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-mint-50 border-mint-200"
              />
              
              <div className="mt-auto pt-4 flex justify-end">
                <Button onClick={handleNextStep1} className="w-full sm:w-auto bg-mint-600 hover:bg-mint-700">
                  Next
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-3 flex-1">
              <div className="text-xs font-bold text-ink-500 uppercase px-2">Select who is involved</div>
              <div className="flex-1 overflow-y-auto max-h-62.5 space-y-2 pr-2">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 p-3 rounded-xl border border-ink-100 bg-white">
                    <input 
                      type="checkbox" 
                      checked={splits[member.id]?.selected ?? false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSplits((prev) => {
                          const current = prev[member.id];
                          return current ? { ...prev, [member.id]: { ...current, selected: checked } } : prev;
                        });
                      }}
                      aria-label={`Include ${member.name} in split`}
                      className="h-5 w-5 rounded border-ink-300 text-mint-600 focus:ring-mint-600"
                    />
                    <div className="flex items-center gap-2 flex-1">
                      <div className="h-8 w-8 rounded-full bg-mint-100 text-mint-700 flex items-center justify-center text-xs font-bold">
                        {member.name[0]}
                      </div>
                      <span className="font-semibold text-sm">{member.name}</span>
                    </div>
                    {splits[member.id]?.selected && (
                      <div className="flex items-center gap-1 w-24">
                        <span className="text-sm font-medium text-ink-500">{currency}</span>
                        <Input 
                          type="number"
                          className="h-8 px-2 text-right text-sm"
                          value={splits[member.id]?.amount ?? ""}
                          onChange={(e) => {
                            setSplits((prev) => {
                              const current = prev[member.id];
                              return current ? { ...prev, [member.id]: { ...current, amount: e.target.value } } : prev;
                            });
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="mt-auto pt-4 flex justify-between gap-3">
                <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">Back</Button>
                <Button onClick={handleNextStep2} className="flex-1 bg-mint-600 hover:bg-mint-700">Next</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4 flex-1">
              <div className="bg-mint-50 p-4 rounded-xl flex items-center justify-between mb-2">
                <div>
                  <div className="text-xs text-ink-500 font-semibold uppercase">Total Expense</div>
                  <div className="font-bold text-xl text-ink-900">{expenseName}</div>
                </div>
                <div className="text-2xl font-black text-mint-600">₱{totalAmount.toFixed(2)}</div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-bold text-ink-500 uppercase">Split Details</div>
                {members.filter((member) => splits[member.id]?.selected && parseFloat(splits[member.id]!.amount) > 0).map((member) => (
                  <div key={member.id} className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-ink-100 flex items-center justify-center text-[10px] font-bold text-ink-600">
                        {member.name[0]}
                      </div>
                      <span className="font-medium text-ink-700">{member.name}</span>
                    </div>
                    <span className="font-bold text-ink-900">{currency} {parseFloat(splits[member.id]!.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-auto pt-4 flex justify-between gap-3">
                <Button variant="secondary" onClick={() => setStep(2)} className="flex-1">Back</Button>
                <Button onClick={handleSubmit} className="flex-1 bg-ink-900 hover:bg-ink-800 text-white">Add Expense</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
