import { useUserBankAccounts } from "@/features/bank-accounts/use-bank-accounts";

interface MemberBankInfoProps {
  userId: string;
}

export function MemberBankInfo({ userId }: MemberBankInfoProps) {
  const { data: accounts = [] } = useUserBankAccounts(userId);

  if (accounts.length === 0) return null;

  return (
    <div className="mt-1.5 space-y-1">
      {accounts.map((account) => (
        <p key={account.id} className="text-[11px] text-slate-500">
          {account.bankName}: <span className="font-mono">{account.accountNumber}</span>
        </p>
      ))}
    </div>
  );
}
