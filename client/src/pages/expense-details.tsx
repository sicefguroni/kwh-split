import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Calendar, Edit3, FileText, Receipt, Split, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentConfirmationModal } from "@/components/expenses/payment-confirmation-modal";
import { AddExpenseModal } from "@/components/expenses/add-expense-modal";
import { useCurrentUser } from "@/features/auth/use-auth";
import { useGroupQuery } from "@/features/groups/use-groups";
import { useExpensesQuery, useUpdateExpenseMutation } from "@/features/expenses/use-expenses";
import { useMarkSettlementPaidMutation } from "@/features/settlements/use-settlements";
import { resolveViewerMemberId } from "@/lib/group-money";
import type { GroupExpense, GroupData } from "@/hooks/use-groups";

export default function ExpenseDetailsPage() {
  const { groupId, expenseId } = useParams<{ groupId: string; expenseId: string }>();
  const navigate = useNavigate();
  const { data: apiGroup } = useGroupQuery(groupId ?? "");
  const { data: apiExpenses = [] } = useExpensesQuery(groupId ?? "");
  const markPaidMutation = useMarkSettlementPaidMutation(groupId ?? "");
  const updateExpenseMutation = useUpdateExpenseMutation(groupId ?? "");
  const { data: user } = useCurrentUser();
  const group: GroupData | undefined = useMemo(
    () =>
      apiGroup
        ? {
            id: apiGroup.id,
            name: apiGroup.name,
            description: apiGroup.description ?? "",
            currency: apiGroup.currency,
            members: apiGroup.members,
            balance: 0,
            createdAt: apiGroup.createdAt,
          }
        : undefined,
    [apiGroup],
  );

  const expenses: GroupExpense[] = useMemo(
    () =>
      apiExpenses.map((expense) => ({
        id: expense.id,
        name: expense.titleDescription,
        amount: expense.totalAmount,
        currency: group?.currency ?? "₱",
        paidBy: expense.paidByUserId ?? "",
        date: expense.saleDate,
        note: expense.note ?? "",
        category: (expense as any).category ?? "General",
        ...(expense.splitType && {
          splitType: expense.splitType as "equal" | "percentage" | "shares" | "exact" | "itemized",
        }),
        splits: expense.splits.map((split) => ({
          memberId: split.userId,
          amount: split.amountOwed,
        })),
        memberDiscounts: (expense.memberDiscounts ?? []).map((discount) => ({
          memberId: discount.userId,
          type: discount.type,
        })),
        status: "synced",
      })),
    [apiExpenses, group?.currency],
  );

  const expense = useMemo(
    () => expenses.find((e) => e.id === expenseId),
    [expenses, expenseId],
  );

  const viewerId = useMemo(
    () => (group ? resolveViewerMemberId(group, user?.name, user?.id) : undefined),
    [group, user?.name, user?.id],
  );
  const isExpensePayer = viewerId !== undefined && expense?.paidBy === viewerId;

  const toExpensePayload = (expense: GroupExpense) => ({
  groupId: Number(groupId),
  titleDescription: expense.name,
  totalAmount: expense.amount,
  ...(expense.paidBy ? { paidByUserId: Number(expense.paidBy) } : {}),
  saleDate: expense.date,
  note: expense.note ?? "",  
  category: expense.category ?? "General",
  taxAmount: 0,
  tipAmount: 0,
  splitType: (expense.splitType ?? "exact") as "equal" | "percentage" | "shares" | "exact" | "itemized",
  participantUserIds: expense.splits.map((split) => Number(split.memberId)),
  splits: expense.splits.map((split) => ({
    userId: Number(split.memberId),
    amount: split.amount,
  })),
  memberDiscounts: (expense.memberDiscounts ?? []).map((entry) => ({
    userId: Number(entry.memberId),
    type: entry.type,
  })),
});

  const memberSplits = useMemo(() => {
    if (!expense || !group) return [];
    return expense.splits.map((split) => {
      const member = group.members.find((m) => m.id === split.memberId);
      const discount = expense.memberDiscounts?.find((d) => d.memberId === split.memberId);
      return {
        memberId: split.memberId,
        memberName: member?.name ?? "Unknown",
        amount: split.amount,
        discountType: discount?.type ?? "none",
      };
    });
  }, [expense, group]);

  const paidByMember = useMemo(
    () => group?.members.find((m) => m.id === expense?.paidBy),
    [group, expense],
  );

  const [paymentModal, setPaymentModal] = useState<{ isOpen: boolean; payerMemberId: string | null }>({
    isOpen: false,
    payerMemberId: null,
  });

  const [paidAmounts, setPaidAmounts] = useState<Record<string, number>>({});

  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<GroupExpense | null>(null);

  const originalAmountsRef = useRef<Record<string, number>>({});
  if (expense) {
    expense.splits.forEach((split) => {
      const key = String(split.memberId);
      if (originalAmountsRef.current[key] === undefined && split.amount > 0) {
        originalAmountsRef.current[key] = split.amount;
      }
    });
  }

  const openPaymentModal = (payerMemberId: string) => {
    setPaymentModal({ isOpen: true, payerMemberId: String(payerMemberId) });
  };

  const closePaymentModal = () => {
    setPaymentModal({ isOpen: false, payerMemberId: null });
  };

  const handleConfirmPayment = async (amount: string) => {
    if (!expense || !viewerId || !expense.paidBy || !paymentModal.payerMemberId) return;
    const splitAmount = Number(amount);
    if (splitAmount <= 0) return;
    const payerMemberId = paymentModal.payerMemberId;
    setPaidAmounts((prev) => ({
      ...prev,
      [String(payerMemberId)]: (prev[String(payerMemberId)] ?? 0) + splitAmount,
    }));
    closePaymentModal();
  };

  const handleOpenEditExpense = (expenseToEdit: GroupExpense) => {
    setSelectedExpense(expenseToEdit);
    setIsAddExpenseOpen(true);
  };

  const handleEditExpense = async (updatedExpense: GroupExpense) => {
    await updateExpenseMutation.mutateAsync({
      expenseId: updatedExpense.id,
      payload: toExpensePayload(updatedExpense),
    });
    setSelectedExpense(null);
    setIsAddExpenseOpen(false);
  };

  if (!group) {
    return (
      <div className="min-h-screen bg-white p-6">
        <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="mt-10 rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Group not found</h1>
          <p className="mt-2 text-sm text-slate-600">This group may have been removed or the link is invalid.</p>
        </div>
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="min-h-screen bg-white p-6">
        <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="mt-10 rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Expense not found</h1>
          <p className="mt-2 text-sm text-slate-600">This expense may have been removed or the link is invalid.</p>
        </div>
      </div>
    );
  }

  const expenseDate = new Date(expense.date);
  const formattedDate = expenseDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const totalPaid = Object.values(paidAmounts).reduce((s, v) => s + v, 0);
  const isFullySettled = expense.splits.every(
    (split) =>
      split.memberId === expense.paidBy ||
      (paidAmounts[String(split.memberId)] ?? 0) >= split.amount - 0.0001,
  );
  const canMarkPaid = isExpensePayer;

  const modalMemberSplit = paymentModal.payerMemberId
    ? expense.splits.find((s) => s.memberId === paymentModal.payerMemberId)
    : null;
  const modalAmountPaid = paymentModal.payerMemberId
    ? (paidAmounts[String(paymentModal.payerMemberId)] ?? 0)
    : 0;
  const modalRemainingAmount = Math.max(0, (modalMemberSplit?.amount ?? 0) - modalAmountPaid);

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white shadow-sm">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 h-14 flex items-center gap-3">
          {/* Left: back arrow + group name */}
          <div className="flex items-center gap-1 min-w-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center justify-center rounded-full p-2 text-slate-700 hover:bg-slate-100 transition flex-shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-base font-semibold text-slate-900 truncate">{group.name}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 pt-6">
        <div className="relative overflow-hidden rounded-3xl">
          <section
className="rounded-3xl p-6 sm:p-8 text-white shadow-xl bg-linear-to-br from-slate-950/92 via-slate-900/75 to-sky-900/65"          >
            <p className="text-xs uppercase tracking-widest text-primary-foreground/70">
              Expense
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight">
              {expense.name}
            </h1>
            <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <div className="text-4xl sm:text-5xl font-bold tracking-tight">
                {expense.currency}{expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-lg text-primary-foreground/80">
                {isFullySettled ? "Fully settled" : `${expense.currency}${(expense.amount - totalPaid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} unsettled`}
              </div>
            </div>
          </section>

          <button
            type="button"
            onClick={() => handleOpenEditExpense(expense)}
            className="absolute right-4 top-4 flex items-center justify-center rounded-full p-2 bg-white/10 ring-1 ring-white/15 transition hover:bg-white/20"
            aria-label="Edit expense"
          >
            <Edit3 className="h-4 w-4" />
          </button>
        </div>

        {/* Meta grid */}
        <section className="mt-5 grid gap-3 sm:grid-cols-2 mb-3">
          <MetaRow
            icon={<UserIcon className="h-4 w-4" />}
            label="Paid by"
            value={paidByMember?.name ?? "Unknown"}
          />
          <MetaRow
            icon={<Calendar className="h-4 w-4" />}
            label="Date"
            value={formattedDate}
          />
          <MetaRow
            icon={<Split className="h-4 w-4" />}
            label="Split type"
            value={
              expense.splitType
                ? expense.splitType.charAt(0).toUpperCase() + expense.splitType.slice(1)
                : "Unknown"
            }
          />
          <MetaRow
            icon={<Receipt className="h-4 w-4" />}
            label="Category"
            value={expense.category ?? "General"}
          />
        </section>

        {/* Notes — only rendered when a note exists */}
        {expense.note && (
          <section className="mb-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-ink-500 font-medium mb-1.5">
              <FileText className="h-3.5 w-3.5" /> Notes
            </div>
            <p className="text-sm text-ink-900 leading-relaxed">{expense.note}</p>
          </section>
        )}

        {/* Individual Splits */}
        <section className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-ink-500 uppercase tracking-widest">
              INDIVIDUAL SPLITS
            </h3>
          </div>

          <ul className="space-y-2">
            {memberSplits.map((split) => {
              const amountPaidForMember = paidAmounts[String(split.memberId)] ?? 0;
              const remainingAmount = Math.max(0, split.amount - amountPaidForMember);
              const isFullyPaid = remainingAmount === 0;
              const isPayer = split.memberId === expense.paidBy;

              return (
                <li
                  key={split.memberId}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm"
                >
                  {/* Avatar */}
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-700">
                    {split.memberName.charAt(0).toUpperCase()}
                  </div>

                  {/* Name + SC/PWD badge */}
                  <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                    <span className="font-semibold text-ink-900 truncate">{split.memberName}</span>
                    {split.discountType !== "none" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap">
                        {split.discountType === "pwd" ? "PWD DISCOUNT" : "SC DISCOUNT"}
                      </span>
                    )}
                  </div>

                  {/* Right: amount + badge/button */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-bold text-ink-900">
                      {expense.currency}
                      {(
                        isFullyPaid
                          ? (originalAmountsRef.current[String(split.memberId)] ?? split.amount)
                          : remainingAmount
                      ).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>

                    {isPayer && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-900 text-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide whitespace-nowrap">
                        <BadgeCheck className="h-3.5 w-3.5" /> Payer
                      </span>
                    )}
                    {!isPayer && isFullyPaid && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-3 py-1.5 text-xs font-bold uppercase tracking-wide whitespace-nowrap">
                        <BadgeCheck className="h-3.5 w-3.5" /> Paid
                      </span>
                    )}
                    {canMarkPaid && !isPayer && !isFullyPaid && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openPaymentModal(split.memberId)}
                        disabled={markPaidMutation.isPending}
                        className="rounded-full h-7 px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
                      >
                        Mark as paid
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      {paymentModal.isOpen && paymentModal.payerMemberId && (
        <PaymentConfirmationModal
          memberName={group.members.find((m) => m.id === paymentModal.payerMemberId)?.name ?? "Unknown"}
          payerName={paidByMember?.name ?? "Unknown"}
          initialAmount={modalRemainingAmount.toFixed(2)}
          maxAmount={modalRemainingAmount.toFixed(2)}
          amountPaid={modalAmountPaid.toFixed(2)}
          totalShare={(modalMemberSplit?.amount ?? 0).toFixed(2)}
          currency={group.currency}
          onConfirm={handleConfirmPayment}
          onCancel={closePaymentModal}
        />
      )}

      {isAddExpenseOpen && selectedExpense && (
        <AddExpenseModal
          isOpen={isAddExpenseOpen}
          onClose={() => {
            setIsAddExpenseOpen(false);
            setSelectedExpense(null);
          }}
          onSubmit={handleEditExpense}
          initialData={selectedExpense}
          members={group.members}
          currency={group.currency}
          groupName={group.name}
        />
      )}
    </div>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-ink-500 font-medium">{label}</div>
        <div className="text-sm font-semibold text-ink-900 truncate">{value}</div>
      </div>
    </div>
  );
}