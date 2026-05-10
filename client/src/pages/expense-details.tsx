import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentConfirmationModal } from "@/components/expenses/payment-confirmation-modal";
import { useCurrentUser } from "@/features/auth/use-auth";
import { useGroupQuery } from "@/features/groups/use-groups";
import { useExpensesQuery} from "@/features/expenses/use-expenses";
import { useMarkSettlementPaidMutation} from "@/features/settlements/use-settlements";
import { resolveViewerMemberId } from "@/lib/group-money";
import type { GroupExpense, GroupData, } from "@/hooks/use-groups";



export default function ExpenseDetailsPage() {
  const { groupId, expenseId } = useParams<{ groupId: string; expenseId: string }>();
  const navigate = useNavigate();
  const { data: apiGroup } = useGroupQuery(groupId ?? "");
  const { data: apiExpenses = [] } = useExpensesQuery(groupId ?? "");
  const markPaidMutation = useMarkSettlementPaidMutation(groupId ?? "");
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
        note: "",
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

  // Get all members with their split info
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

  // Capture each member's original split amount the first time we see a non-zero value.
  // The server returns amountOwed = 0 once fully paid, so we must snapshot it early.
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

    await markPaidMutation.mutateAsync({
      fromUserId: Number(payerMemberId),
      toUserId: Number(expense.paidBy),
      amount: Number(splitAmount.toFixed(2)),
    });
    
    setPaidAmounts((prev) => ({
      ...prev,
      [String(payerMemberId)]: (prev[String(payerMemberId)] ?? 0) + splitAmount,
    }));
    
    closePaymentModal();
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
  const formattedDate = expenseDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  const modalMemberSplit = paymentModal.payerMemberId
    ? expense.splits.find((s) => s.memberId === paymentModal.payerMemberId)
    : null;
  const modalAmountPaid = paymentModal.payerMemberId
    ? (paidAmounts[String(paymentModal.payerMemberId)] ?? 0)
    : 0;
  const modalRemainingAmount = Math.max(0, (modalMemberSplit?.amount ?? 0) - modalAmountPaid);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 rounded-full p-2 text-slate-700 hover:bg-slate-100 transition"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-slate-900">{group.name}</h1>
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-3xl px-4 py-8">
        {/* Expense Detail Section */}
        <div className="mb-8">
          <div className="rounded-3xl bg-white p-8 shadow-sm text-center">

            {/* Expense Name */}
            <h2 className="text-2xl font-bold text-ink-900 mb-4">{expense.name}</h2>

            {/* Expense Amount */}
            <p className="text-4xl font-bold text-ink-900 mb-6">
              {expense.currency}{expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>

            {/* Metadata Info */}
            <div className="space-y-3 border-t border-slate-200 pt-6">
              {/* Paid by */}
              <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <span className="text-sm text-ink-500 font-medium">Paid by</span>
                <span className="text-sm font-semibold text-ink-500">{paidByMember?.name ?? "Unknown"}</span>
              </div>

              {/* Date */}
              <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <span className="text-sm text-ink-500 font-medium">Date</span>
                <span className="text-sm font-semibold text-ink-500">{formattedDate}</span>
              </div>
               {/* Split Type */}
              <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <span className="text-sm text-ink-500 font-medium">Split Type</span>
                <span className="text-sm font-semibold text-ink-500">
                  {expense.splitType
                    ? expense.splitType.charAt(0).toUpperCase() + expense.splitType.slice(1)
                    : "Unknown"}
                </span>
              </div>
               {/* Notes */}
                <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <span className="text-sm text-ink-500 font-medium">Notes</span>
                <span className="text-sm font-semibold text-ink-500">{expense.note || "-"}</span>
                </div>
            </div>
          </div>
        </div>

        {/* Individual Splits Section */}
        <div>
          <h3 className="text-lg font-semibold text-ink-900 mb-4 uppercase tracking-wide">Individual Splits</h3>
          <div className="space-y-3">
            {memberSplits.map((split) => {
              const amountPaidForMember = paidAmounts[String(split.memberId)] ?? 0;
              const remainingAmount = Math.max(0, split.amount - amountPaidForMember);
              const isFullyPaid = remainingAmount === 0;

              return (
                <div
                  key={split.memberId}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  {/* Left: Avatar + Name/Discount */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-200 text-sm font-bold text-slate-700">
                      {split.memberName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center md:gap-2 min-w-0 ">
                      <span className="truncate font-semibold text-ink-900">{split.memberName}</span>
                      {split.discountType !== "none" && (
                        <div className=" text-emerald-400 text-xs font-semibold font-['Sans Serif'] whitespace-nowrap">
                          {split.discountType === "pwd" ? "PWD DISCOUNT" : "SC DISCOUNT"}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Amount + Button */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-base font-bold text-ink-900">
                        {expense.currency}{(isFullyPaid ? (originalAmountsRef.current[String(split.memberId)] ?? split.amount) : remainingAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    {split.memberId === expense.paidBy && (
                      <span className="text-xs font-semibold text-emerald-700 px-3 py-2 bg-emerald-50 rounded-xl whitespace-nowrap">
                        PAID
                      </span>
                    )}
                    {split.memberId !== expense.paidBy && isFullyPaid && (
                      <span className="text-xs font-semibold text-emerald-700 px-3 py-2 bg-emerald-50 rounded-xl whitespace-nowrap">
                        PAID
                      </span>
                    )}
                    {split.memberId !== expense.paidBy && !isFullyPaid && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openPaymentModal(split.memberId)}
                        disabled={markPaidMutation.isPending}
                        className="rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
                      >
                        Mark as Paid
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {paymentModal.isOpen && paymentModal.payerMemberId && (
        <PaymentConfirmationModal
          memberName={group.members.find((m) => m.id === paymentModal.payerMemberId)?.name ?? "Unknown"}
          payerName={paidByMember?.name ?? "Unknown"}
          initialAmount={modalRemainingAmount.toFixed(2)}
          maxAmount={modalRemainingAmount.toFixed(2)}
          currency={group.currency}
          onConfirm={handleConfirmPayment}
          onCancel={closePaymentModal}
        />
      )}
    </div>
  );
}