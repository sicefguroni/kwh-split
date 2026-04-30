import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Edit3, Plus, Wifi, WifiOff } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<"overview" | "expenses" | "members">("overview");
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<GroupExpense | null>(null);
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
    setExpenses((prev) => prev.map((item) => (item.id === expense.id ? { ...expense, status: isOnline ? "synced" : "pending" } : item)));
    setSelectedExpense(null);
    setIsAddExpenseOpen(false);
  };

  const handleOpenEditExpense = (expense: GroupExpense) => {
    setSelectedExpense(expense);
    setIsAddExpenseOpen(true);
  };

  const onlineLabel = isOnline ? "Online" : "Offline";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="relative overflow-hidden bg-linear-to-br from-slate-900 via-slate-800 to-sky-700 px-4 pb-16 pt-10 text-white">
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_35%)]" />
        <div className="relative mx-auto max-w-5xl flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3">
            <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <span
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15"
              title={onlineLabel}
              aria-label={onlineLabel}
            >
              {isOnline ? <Wifi className="h-5 w-5" aria-hidden /> : <WifiOff className="h-5 w-5" aria-hidden />}
            </span>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-4xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">
              <div className="flex items-start gap-4">
                <img
                  src={group.imageUrl ?? "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=1200&q=80"}
                  alt={group.name}
                  className="h-20 w-20 rounded-3xl object-cover shadow-lg"
                />
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-200/80">Group</p>
                  <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{group.name}</h1>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-200/80">{group.description}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl bg-white/10 p-4 text-white shadow-xl ring-1 ring-white/10">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-300/80">Members</p>
                  <p className="mt-3 text-2xl font-semibold">{group.members.length}</p>
                </div>
                <div className="rounded-3xl bg-white/10 p-4 text-white shadow-xl ring-1 ring-white/10">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-300/80">Expenses</p>
                  <p className="mt-3 text-2xl font-semibold">{expenses.length}</p>
                </div>
              </div>

              {pendingCount > 0 ? (
                <p className="mt-4 text-xs font-medium text-amber-200/95">
                  {pendingCount} item{pendingCount !== 1 ? "s" : ""} not synced yet
                </p>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-3">
                <Button size="sm" className="rounded-full bg-white text-slate-950 hover:bg-slate-100" onClick={() => {
                  setSelectedExpense(null);
                  setIsAddExpenseOpen(true);
                }}>
                  <Plus className="mr-2 h-4 w-4" /> Add Expense
                </Button>
                <Button size="sm" variant="secondary" className="rounded-full bg-slate-900/80 text-white hover:bg-slate-800" onClick={() => setIsEditGroupOpen(true)}>
                  <Edit3 className="mr-2 h-4 w-4" /> Edit Group
                </Button>
              </div>
            </div>

            <div className="rounded-4xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-200/80">Total spending</p>
              <p className="mt-3 text-4xl font-semibold text-white">
                {group.currency}{" "}
                {totalSpentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-5 text-xs uppercase tracking-[0.3em] text-slate-200/80">Your balance</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {group.currency}{" "}
                {viewerNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-1 text-xs text-slate-300/90">
                {viewerNet >= 0
                  ? "After splits, others owe you about this much in this group."
                  : "After splits, you owe about this much in this group."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl space-y-6 px-4 pb-16 pt-8 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <nav className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            {[
              { id: "overview", label: "Overview" },
              { id: "expenses", label: "Expenses" },
              { id: "members", label: "Members" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={cn(
                  "flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition",
                  activeTab === tab.id
                    ? "bg-slate-950 text-white"
                    : "text-slate-600 hover:bg-slate-50",
                )}
              >
                {tab.label}
                <span className="text-xs text-slate-400">{tab.id === "expenses" ? expenses.length : tab.id === "members" ? group.members.length : ""}</span>
              </button>
            ))}
          </nav>

          <section className="space-y-6">
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Group details</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{group.description}</p>
                    </div>
                    <div>
                      <h3 className="text-sm uppercase tracking-[0.3em] text-slate-500">Current total</h3>
                      <p className="mt-2 text-3xl font-semibold text-slate-900">
                        {group.currency}{" "}
                        {totalSpentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">Total of all saved expenses in this group.</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900">Balances with you</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Based on who paid and each person’s split, when you or they covered the bill.
                  </p>

                  {balancesWithOthers.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-500">Add another member to see pairwise balances.</p>
                  ) : expenses.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-500">Add expenses to see how much each member owes you (or you owe them).</p>
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
                                    settled ? "text-slate-500" : row.netOwesYou > 0 ? "text-emerald-700" : "text-amber-800",
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
                    Expenses paid by someone else aren’t split between pairs here—only when you or this member paid.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "expenses" && (
              <div className="space-y-4">
                {expenses.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
                    <p className="text-sm font-semibold text-slate-900">No expenses yet</p>
                    <p className="mt-2 text-sm text-slate-500">Create an expense and it will be saved locally until it syncs.</p>
                    <div className="mt-5 flex justify-center">
                      <Button onClick={() => {
                        setSelectedExpense(null);
                        setIsAddExpenseOpen(true);
                      }}>
                        <Plus className="mr-2 h-4 w-4" /> Add expense
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {expenses.map((expense) => (
                      <div key={expense.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{expense.name}</p>
                            <p className="text-xs text-slate-500">{new Date(expense.date).toLocaleDateString()}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold uppercase", expense.status === "pending" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800")}>
                              {expense.status}
                            </span>
                            <Button size="sm" variant="secondary" onClick={() => handleOpenEditExpense(expense)}>
                              Edit
                            </Button>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-3xl bg-slate-50 p-4">
                            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Amount</p>
                            <p className="mt-2 text-lg font-semibold text-slate-900">{group.currency} {expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          </div>
                          <div className="rounded-3xl bg-slate-50 p-4">
                            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Paid by</p>
                            <p className="mt-2 text-lg font-semibold text-slate-900">{group.members.find((member) => member.id === expense.paidBy)?.name ?? "Unknown"}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "members" && (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="grid gap-4 sm:grid-cols-2">
                  {group.members.map((member) => (
                    <div key={member.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-200 text-sm font-bold text-slate-700">{member.name.charAt(0)}</div>
                        <div>
                          <p className="font-semibold text-slate-900">{member.name}</p>
                          <p className="text-sm text-slate-500">{member.isAdmin ? "Admin" : "Member"}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
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
