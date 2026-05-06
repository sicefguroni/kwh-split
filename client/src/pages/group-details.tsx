import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Edit3, MoreVertical, Plus, Trash2, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddExpenseModal } from "@/components/expenses/add-expense-modal";
import { AddGroupModal } from "@/components/dashboard/add-group-modal";
import { usePersistentState, useOnlineStatus } from "@/hooks/use-persistent-state";
import { type GroupData, type GroupExpense, useGroupsState } from "@/hooks/use-groups";
import { useCurrentUser } from "@/features/auth/use-auth";
import {
  netForMember,
  netMemberOwesViewer,
  resolveViewerMemberId,
  totalSpent,
} from "@/lib/group-money";
import { cn } from "@/lib/cn";

export default function GroupDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [groups, setGroups] = useGroupsState();
  const group = groups.find((groupItem) => groupItem.id === id);
  const [expenses, setExpenses] = usePersistentState<GroupExpense[]>(`group-expenses-${id ?? "unknown"}`, []);
  const [activeTab, setActiveTab] = useState<"expenses" | "balances" | "members">("expenses");
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<GroupExpense | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const isOnline = useOnlineStatus();
  const { data: user } = useCurrentUser();

  const totalSpentValue = useMemo(() => totalSpent(expenses), [expenses]);

  const pendingCount = useMemo(
    () => expenses.filter((expense) => expense.status === "pending").length,
    [expenses],
  );

  const viewerNet = useMemo(() => {
    if (!group) return 0;
    const vid = resolveViewerMemberId(group, user?.name);
    return vid ? netForMember(expenses, vid) : 0;
  }, [group, expenses, user?.name]);

  const balancesWithOthers = useMemo(() => {
    if (!group) return [];
    const vid = resolveViewerMemberId(group, user?.name);
    if (!vid) return [];
    return group.members
      .filter((m) => m.id !== vid)
      .map((m) => ({
        id: m.id,
        name: m.name,
        netOwesYou: netMemberOwesViewer(expenses, vid, m.id),
      }));
  }, [group, expenses, user?.name]);

  const groupedExpenses = useMemo(() => {
    const map = new Map<string, GroupExpense[]>();
    for (const expense of expenses) {
      const key = new Date(expense.date).toDateString();
      const arr = map.get(key) ?? [];
      arr.push(expense);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
  }, [expenses]);

  useEffect(() => {
    if (!isOnline) return;
    setExpenses((prev) =>
      prev.map((expense) =>
        expense.status === "pending" ? { ...expense, status: "synced" } : expense,
      ),
    );
  }, [isOnline, setExpenses]);

  useEffect(() => {
    if (!group) return;
    const vid = resolveViewerMemberId(group, user?.name);
    if (!vid) return;
    const bal = netForMember(expenses, vid);
    setGroups((prev) => {
      const cur = prev.find((g) => g.id === group.id);
      if (!cur || cur.balance === bal) return prev;
      return prev.map((g) => (g.id === group.id ? { ...g, balance: bal } : g));
    });
  }, [expenses, group, user?.name, setGroups]);

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

  const handleSaveGroup = (updated: GroupData) => {
    setGroups((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setIsEditGroupOpen(false);
  };

  const handleAddExpense = (expense: GroupExpense) => {
    setExpenses((prev) => [{ ...expense, status: isOnline ? "synced" : "pending" }, ...prev]);
    setSelectedExpense(null);
    setIsAddExpenseOpen(false);
  };

  const handleEditExpense = (expense: GroupExpense) => {
    setExpenses((prev) =>
      prev.map((item) =>
        item.id === expense.id ? { ...expense, status: isOnline ? "synced" : "pending" } : item,
      ),
    );
    setSelectedExpense(null);
    setIsAddExpenseOpen(false);
  };

  const handleOpenEditExpense = (expense: GroupExpense) => {
    setSelectedExpense(expense);
    setIsAddExpenseOpen(true);
    setOpenMenuId(null);
  };

  const handleDeleteExpense = (expenseId: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
    setOpenMenuId(null);
  };

  const onlineLabel = isOnline ? "Online" : "Offline";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="relative overflow-hidden bg-linear-to-br from-slate-900 via-slate-800 to-sky-700 text-white">
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_35%)]" />

        <div className="relative mx-auto max-w-3xl px-4 pt-6 pb-0">
          {/* Top bar */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15"
                title={onlineLabel}
                aria-label={onlineLabel}
              >
                {isOnline ? <Wifi className="h-4 w-4" aria-hidden /> : <WifiOff className="h-4 w-4" aria-hidden />}
              </span>
              <button
                type="button"
                onClick={() => setIsEditGroupOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 transition hover:bg-white/20"
                aria-label="Edit group"
              >
                <Edit3 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Group identity row */}
          <div className="mt-5 flex items-center gap-4">
            <img
              src={group.imageUrl ?? "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=1200&q=80"}
              alt={group.name}
              className="h-16 w-16 flex-shrink-0 rounded-2xl object-cover shadow-lg ring-2 ring-white/20"
            />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-bold uppercase tracking-wide text-white">
                {group.name}
              </h1>
              <p className="mt-0.5 text-xs text-slate-300/80">Group Total</p>
              <p className="text-xl font-semibold text-white">
                {group.currency}
                {totalSpentValue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="flex-shrink-0">
              <Button
                size="sm"
                className="rounded-full bg-slate-900/80 text-white ring-1 ring-white/20 hover:bg-slate-800"
                onClick={() => {
                  setSelectedExpense(null);
                  setIsAddExpenseOpen(true);
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Add Expense
              </Button>
            </div>
          </div>

          {pendingCount > 0 && (
            <p className="mt-3 text-xs font-medium text-amber-200/95">
              {pendingCount} item{pendingCount !== 1 ? "s" : ""} not synced yet
            </p>
          )}

          {/* Horizontal tabs */}
          <div className="mt-6 flex gap-1">
            {(
              [
                { id: "expenses", label: "Expenses", count: expenses.length },
                { id: "balances", label: "Balances", count: null },
                { id: "members", label: "Members", count: group.members.length },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-t-2xl px-4 py-3 text-xs font-semibold uppercase tracking-widest transition",
                  activeTab === tab.id
                    ? "bg-white/15 text-white shadow-inner backdrop-blur-md ring-1 ring-white/20"
                    : "text-slate-400 hover:text-white/70",
                )}
              >
                {tab.label}
                {tab.count !== null && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                      activeTab === tab.id
                        ? "bg-white/20 text-white"
                        : "bg-white/10 text-slate-400",
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* EXPENSES */}
        {activeTab === "expenses" && (
          <div className="space-y-4">
            {expenses.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <p className="text-sm font-semibold text-slate-900">No expenses yet</p>
                <p className="mt-2 text-sm text-slate-500">
                  Create an expense and it will be saved locally until it syncs.
                </p>
                <div className="mt-5 flex justify-center">
                  <Button
                    onClick={() => {
                      setSelectedExpense(null);
                      setIsAddExpenseOpen(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add expense
                  </Button>
                </div>
              </div>
            ) : (
              groupedExpenses.map(({ date, items }) => (
                <div key={date} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {items.map((expense, idx) => {
                    const d = new Date(expense.date);
                    const month = d.toLocaleString(undefined, { month: "short" }).toUpperCase();
                    const day = d.getDate();
                    const paidByName = group.members.find((m) => m.id === expense.paidBy)?.name ?? "Unknown";
                    const vid = resolveViewerMemberId(group, user?.name);
                    const viewerIsPayee = vid === expense.paidBy;
                    const viewerSplit = vid ? expense.splits.find((s) => s.memberId === vid) : undefined;
                    const isLast = idx === items.length - 1;
                    return (
                      <div
                        key={expense.id}
                        className={cn(
                          "relative flex items-center gap-4 bg-white px-4 py-3",
                          !isLast && "border-b border-slate-100",
                        )}
                      >
                        {/* Date badge */}
                        <div className="flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center rounded-xl bg-sky-500 text-white">
                          <span className="text-[10px] font-semibold uppercase leading-none tracking-wide">{month}</span>
                          <span className="mt-0.5 text-xl font-bold leading-none">{day}</span>
                        </div>

                        {/* Middle: name + paid by */}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-900">{expense.name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">Paid by {paidByName}</p>
                        </div>

                        {/* Right: amount + your share */}
                        <div className="flex-shrink-0 text-right">
                          <p className="font-bold text-slate-900">
                            {group.currency}{expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            your share{" "}
                            {viewerIsPayee ? (
                              <span className="font-semibold text-emerald-700">PAID</span>
                            ) : viewerSplit ? (
                              <span className="font-semibold text-slate-700">
                                {group.currency}{viewerSplit.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className="font-semibold text-slate-400">—</span>
                            )}
                          </p>
                        </div>

                        {/* Three-dot menu */}
                        <div className="relative flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setOpenMenuId(openMenuId === expense.id ? null : expense.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                            aria-label="Expense options"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          {openMenuId === expense.id && (
                            <div className="absolute right-0 top-9 z-10 min-w-[120px] rounded-2xl border border-slate-200 bg-white py-1 shadow-lg">
                              <button
                                type="button"
                                onClick={() => handleOpenEditExpense(expense)}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                              >
                                <Edit3 className="h-3.5 w-3.5" /> Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteExpense(expense.id)}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        )}

        {/* BALANCES */}
        {activeTab === "balances" && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Your net balance</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {group.currency}{" "}
                {viewerNet.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {viewerNet >= 0
                  ? "After splits, others owe you about this much in this group."
                  : "After splits, you owe about this much in this group."}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Balances with you</h3>
              <p className="mt-1 text-sm text-slate-500">
                Based on who paid and each person&apos;s split, when you or they covered the bill.
              </p>

              {balancesWithOthers.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  Add another member to see pairwise balances.
                </p>
              ) : expenses.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  Add expenses to see how much each member owes you (or you owe them).
                </p>
              ) : (
                <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-100">
                  <table className="w-full min-w-[280px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3">Member</th>
                        <th className="px-4 py-3 text-right">With you</th>
                      </tr>
                    </thead>
                    <tbody>
                      {balancesWithOthers.map((row) => {
                        const abs = Math.abs(row.netOwesYou);
                        const settled = abs < 0.005;
                        let label: string;
                        if (settled) label = "Settled up";
                        else if (row.netOwesYou > 0)
                          label = `Owes you ${group.currency} ${abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        else
                          label = `You owe ${group.currency} ${abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        return (
                          <tr key={row.id} className="border-b border-slate-50 last:border-0">
                            <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                            <td
                              className={cn(
                                "px-4 py-3 text-right font-semibold tabular-nums",
                                settled
                                  ? "text-slate-500"
                                  : row.netOwesYou > 0
                                    ? "text-emerald-700"
                                    : "text-amber-800",
                              )}
                            >
                              {label}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-4 text-xs text-slate-400">
                Expenses paid by someone else are not split between pairs here—only when you or this
                member paid.
              </p>
            </div>
          </div>
        )}

        {/* MEMBERS */}
        {activeTab === "members" && (
          <div className="grid gap-4 sm:grid-cols-2">
            {group.members.map((member) => (
              <div key={member.id} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-200 text-sm font-bold text-slate-700">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{member.name}</p>
                    <p className="text-sm text-slate-500">{member.isAdmin ? "Admin" : "Member"}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <AddExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => {
          setSelectedExpense(null);
          setIsAddExpenseOpen(false);
        }}
        onSubmit={selectedExpense ? handleEditExpense : handleAddExpense}
        initialData={selectedExpense ?? undefined}
        members={group.members}
        currency={group.currency}
      />

      <AddGroupModal
        isOpen={isEditGroupOpen}
        onClose={() => setIsEditGroupOpen(false)}
        onSubmit={handleSaveGroup}
        initialData={group}
      />
    </div>
  );
}