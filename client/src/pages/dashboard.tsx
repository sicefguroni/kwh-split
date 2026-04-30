import { ChevronRight, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { EmptyGroupsState } from "@/components/dashboard/empty-groups-state";
import { GroupCard } from "@/components/dashboard/group-card";
import { AddGroupModal, type AddGroupData } from "@/components/dashboard/add-group-modal";
import { useCurrentUser, useLogoutMutation } from "@/features/auth/use-auth";
import { useOnlineStatus } from "@/hooks/use-persistent-state";
import { useGroupsState, type GroupData } from "@/hooks/use-groups";
import {
  netForMember,
  readGroupExpensesFromStorage,
  resolveViewerMemberId,
  totalSpentAcrossGroups,
} from "@/lib/group-money";

const getFirstName = (fullName: string | undefined): string =>
  fullName?.split(" ")[0] ?? "there";

function formatMoney(amount: number): string {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const logout = useLogoutMutation();
  const isOnline = useOnlineStatus();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [groups, setGroups] = useGroupsState();

  useEffect(() => {
    setGroups((prev) => {
      let changed = false;
      const next = prev.map((g) => {
        const vid = resolveViewerMemberId(g, user?.name);
        if (!vid) return g;
        const bal = netForMember(readGroupExpensesFromStorage(g.id), vid);
        if (g.balance !== bal) changed = true;
        return { ...g, balance: bal };
      });
      return changed ? next : prev;
    });
  }, [user?.name, setGroups, groups.length]);

  const totalBalance = useMemo(
    () => groups.reduce((sum, group) => sum + group.balance, 0),
    [groups],
  );

  const totalTrackedSpend = useMemo(() => totalSpentAcrossGroups(groups), [groups]);

  const expenseCountTotal = useMemo(
    () => groups.reduce((n, g) => n + readGroupExpensesFromStorage(g.id).length, 0),
    [groups],
  );

  const handleLogout = async (): Promise<void> => {
    await logout.mutateAsync();
    navigate("/login", { replace: true });
  };

  const handleAddGroup = (data: AddGroupData) => {
    const newGroup: GroupData = {
      id: Math.random().toString(36).substring(7),
      name: data.name,
      description: data.description,
      currency: data.currency,
      ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
      members: data.members,
      balance: 0,
      createdAt: new Date().toISOString(),
    };
    setGroups([newGroup, ...groups]);
    setIsAddModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-white">
      <DashboardHeader
        onLogout={handleLogout}
        isLoggingOut={logout.isPending}
        isOnline={isOnline}
      />

      <div className="relative overflow-hidden bg-linear-to-br from-[#0a3d4a] via-[#0c749f] to-[#38bdf8] px-4 pb-14 pt-8 text-white shadow-xl sm:px-6 sm:pb-16 sm:pt-10">
        <div className="pointer-events-none absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_20%_0%,rgba(255,255,255,0.18),transparent_50%),radial-gradient(circle_at_85%_70%,rgba(255,255,255,0.12),transparent_40%)]" />
        <div className="relative z-10 mx-auto max-w-5xl space-y-10">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
            <div className="flex max-w-xl flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
              <div className="shrink-0 rounded-2xl bg-white/95 p-4 shadow-lg ring-1 ring-white/50 sm:p-6">
                <Logo size="lg" className="h-[4.5rem] w-auto sm:h-[6rem] sm:max-h-none" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-100/85">
                  Dashboard
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Hello, {getFirstName(user?.name)}
                </h1>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-sky-100/90">
                  Track group spending and your share. Numbers below update from expenses you add in each group.
                </p>
              </div>
            </div>

            <div className="flex w-full max-w-sm flex-col gap-3 lg:shrink-0 lg:items-end">
              <div className="w-full rounded-3xl border border-white/20 bg-white/10 px-5 py-4 text-left shadow-lg backdrop-blur-md sm:text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-sky-100/75">
                  Your net across groups
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums">
                  ₱{formatMoney(totalBalance)}
                </p>
                <p className="mt-1 text-xs text-sky-100/75">Positive means others owe you more than you owe them.</p>
              </div>
              <Button
                size="md"
                className="w-full rounded-full bg-white px-6 py-3 font-semibold text-slate-950 shadow-lg transition hover:bg-slate-100 sm:w-auto"
                onClick={() => setIsAddModalOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" /> Add Group
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-lg backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-sky-100/75">Groups</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums">{groups.length}</p>
              <p className="mt-2 text-xs leading-snug text-sky-100/80">Active expense groups in this browser.</p>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-lg backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-sky-100/75">Expenses logged</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums">{expenseCountTotal}</p>
              <p className="mt-2 text-xs leading-snug text-sky-100/80">Receipt lines saved across all groups.</p>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-lg backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-sky-100/75">All spending</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums">₱{formatMoney(totalTrackedSpend)}</p>
              <p className="mt-2 text-xs leading-snug text-sky-100/80">Sum of every expense logged in your groups.</p>
            </div>
          </div>

          {groups.length > 0 ? (
            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-lg backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-sky-100/75">Quick open</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {groups.map((g) => (
                  <Link
                    key={g.id}
                    to={`/group/${g.id}`}
                    className="group inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 py-2 pl-4 pr-3 text-sm font-semibold text-white transition hover:bg-white/20"
                  >
                    <span className="max-w-[10rem] truncate">{g.name}</span>
                    <span className="tabular-nums text-sky-100/90">
                      {g.currency} {formatMoney(Math.abs(g.balance))}
                      {g.balance !== 0 ? (
                        <span className="ml-1 text-[10px] font-medium text-sky-200/90">
                          {g.balance > 0 ? "in your favor" : "you owe"}
                        </span>
                      ) : null}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-sky-200 opacity-80 group-hover:translate-x-0.5 transition" aria-hidden />
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <section className="flex flex-col gap-4">
          <div className="rounded-3xl border border-ink-100 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-ink-900">Your groups</h2>
            <p className="mt-1 text-sm text-ink-500">
              Open a group for expenses, member balances, and overview.
            </p>
            <p className="mt-1 text-xs text-ink-400">
              {isOnline
                ? "Data stays in this browser until server sync is connected."
                : "You appear offline. Edits stay in this browser until you are back online."}
            </p>
          </div>

          <section aria-labelledby="groups-heading" className="flex flex-col gap-4">
            {groups.length === 0 ? (
              <EmptyGroupsState onCreate={() => setIsAddModalOpen(true)} />
            ) : (
              groups.map((group) => (
                <GroupCard key={group.id} {...group} />
              ))
            )}
          </section>
        </section>
      </main>

      <AddGroupModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddGroup}
      />
    </div>
  );
}
