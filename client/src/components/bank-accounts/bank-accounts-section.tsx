import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useOwnBankAccounts,
  useAddBankAccountMutation,
  useDeleteBankAccountMutation,
} from "@/features/bank-accounts/use-bank-accounts";

export function BankAccountsSection() {
  const { data: accounts = [], isLoading } = useOwnBankAccounts();
  const addMutation = useAddBankAccountMutation();
  const deleteMutation = useDeleteBankAccountMutation();
  const [isAdding, setIsAdding] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  const handleAdd = async () => {
    if (!bankName.trim() || !accountNumber.trim()) return;
    await addMutation.mutateAsync({ bankName: bankName.trim(), accountNumber: accountNumber.trim() });
    setBankName("");
    setAccountNumber("");
    setIsAdding(false);
  };

  if (isLoading) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700">Your Bank Accounts</h4>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 px-4 py-2 rounded-full"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        )}
      </div>

      {accounts.length === 0 && !isAdding && (
        <p className="text-xs text-slate-400">No bank accounts added yet.</p>
      )}

      {accounts.map((account) => (
        <div
          key={account.id}
          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{account.bankName}</p>
            <p className="text-xs text-slate-500 font-mono">{account.accountNumber}</p>
          </div>
          <button
            type="button"
            onClick={() => deleteMutation.mutate(account.id)}
            disabled={deleteMutation.isPending}
            className="p-1.5 text-slate-400 hover:text-red-500 transition"
            aria-label={`Remove ${account.bankName}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {isAdding && (
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <Input
            placeholder="Bank name"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            className="h-10 border-slate-200 bg-white text-sm"
          />
          <Input
            placeholder="Account number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            className="h-10 border-slate-200 bg-white text-sm"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => { setIsAdding(false); setBankName(""); setAccountNumber(""); }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={addMutation.isPending || !bankName.trim() || !accountNumber.trim()}
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
