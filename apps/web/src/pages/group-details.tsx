import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Edit3, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddExpenseModal } from "@/components/expenses/add-expense-modal";
import { AddGroupModal } from "@/components/dashboard/add-group-modal";
import { usePersistentState, useOnlineStatus } from "@/hooks/use-persistent-state";
import { type GroupData, type GroupExpense, useGroupsState } from "@/hooks/use-groups";
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

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, expense) => sum + expense.amount, 0),
    [expenses],
  );

  const pendingCount = useMemo(
    () => expenses.filter((expense) => expense.status === "pending").length,
    [expenses],
  );

  useEffect(() => {
    if (!isOnline) return;
    setExpenses((prev) =>
      prev.map((expense) =>
        expense.status === "pending" ? { ...expense, status: "synced" } : expense,
      ),
    );
  }, [isOnline, setExpenses]);

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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="relative overflow-hidden bg-linear-to-br from-slate-900 via-slate-800 to-sky-700 px-4 pb-16 pt-10 text-white">
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_35%)]" />
        <div className="relative mx-auto max-w-5xl flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3">
            <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/80">
              {isOnline ? "Online" : "Offline"}
            </div>
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

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl bg-white/10 p-4 text-white shadow-xl ring-1 ring-white/10">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-300/80">Members</p>
                  <p className="mt-3 text-2xl font-semibold">{group.members.length}</p>
                </div>
                <div className="rounded-3xl bg-white/10 p-4 text-white shadow-xl ring-1 ring-white/10">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-300/80">Expenses</p>
                  <p className="mt-3 text-2xl font-semibold">{expenses.length}</p>
                </div>
                <div className="rounded-3xl bg-white/10 p-4 text-white shadow-xl ring-1 ring-white/10">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-300/80">Pending sync</p>
                  <p className="mt-3 text-2xl font-semibold">{pendingCount}</p>
                </div>
              </div>

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
              <p className="text-xs uppercase tracking-[0.3em] text-slate-200/80">Group balance</p>
              <p className="mt-3 text-4xl font-semibold text-white">{group.currency} {group.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <div className="mt-3 rounded-3xl bg-white/10 p-4 text-sm text-slate-200/80">
                Total saved locally to this group: <span className="font-semibold text-white">{expenses.length} items</span>
              </div>
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
              <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Group details</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{group.description}</p>
                  </div>
                  <div>
                    <h3 className="text-sm uppercase tracking-[0.3em] text-slate-500">Current total</h3>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">{group.currency} {totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className="mt-2 text-sm text-slate-500">This is the total of all saved expenses for the group.</p>
                  </div>
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
