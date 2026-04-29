import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { EmptyGroupsState } from "@/components/dashboard/empty-groups-state";
import { GroupCard } from "@/components/dashboard/group-card";
import { AddGroupModal, type AddGroupData } from "@/components/dashboard/add-group-modal";
import { useCurrentUser, useLogoutMutation } from "@/features/auth/use-auth";
import { useOnlineStatus } from "@/hooks/use-persistent-state";
import { useGroupsState, type GroupData } from "@/hooks/use-groups";

const getFirstName = (fullName: string | undefined): string =>
  fullName?.split(" ")[0] ?? "there";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const logout = useLogoutMutation();
  const isOnline = useOnlineStatus();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [groups, setGroups] = useGroupsState();

  const totalBalance = useMemo(
    () => groups.reduce((sum, group) => sum + group.balance, 0),
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

      <div className="relative overflow-hidden bg-linear-to-br from-[#064e7b] via-[#0c749f] to-[#38bdf8] px-4 pb-10 pt-10 text-white shadow-xl">
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_45%)]"></div>
        <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="relative z-10">
            <p className="text-sm uppercase tracking-[0.24em] text-sky-100/80">
              Dashboard
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Hello, {getFirstName(user?.name)}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-sky-100/80">
              Manage group expenses, track balances, and keep your plans safe when you go offline.
            </p>
          </div>

          <div className="relative z-10 flex flex-col gap-3 sm:items-end">
            <div className="rounded-3xl border border-white/15 bg-white/10 px-4 py-3 text-right shadow-lg backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-sky-100/70">Total balance</p>
              <p className="mt-2 text-2xl font-semibold">
                ₱{totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <Button
              size="md"
              className="rounded-full bg-white px-6 py-3 font-semibold text-slate-950 shadow-lg transition hover:bg-slate-100"
              onClick={() => setIsAddModalOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" /> Add Group
            </Button>
          </div>
        </div>
        <div className="relative z-10 mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-3xl bg-white/10 p-4 shadow-xl backdrop-blur-sm border border-white/10">
            <p className="text-xs uppercase tracking-[0.3em] text-sky-100/80">Groups</p>
            <p className="mt-2 text-2xl font-semibold">{groups.length}</p>
          </div>
          <div className="rounded-3xl bg-white/10 p-4 shadow-xl backdrop-blur-sm border border-white/10">
            <p className="text-xs uppercase tracking-[0.3em] text-sky-100/80">Status</p>
            <p className="mt-2 text-2xl font-semibold">
              {isOnline ? "Online" : "Offline"}
            </p>
          </div>
          <div className="rounded-3xl bg-white/10 p-4 shadow-xl backdrop-blur-sm border border-white/10">
            <p className="text-xs uppercase tracking-[0.3em] text-sky-100/80">Saved locally</p>
            <p className="mt-2 text-2xl font-semibold">Yes</p>
          </div>
        </div>
      </div>

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm border border-ink-100">
            <div>
              <h2 className="text-xl font-semibold text-ink-900">Your groups</h2>
              <p className="mt-1 text-sm text-ink-500">
                Open a group to see expenses, members, and trip details.
              </p>
            </div>
            <div className="rounded-full bg-mint-50 px-4 py-2 text-sm font-semibold text-ink-900">
              {isOnline ? "Sync enabled" : "Offline mode"}
            </div>
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
