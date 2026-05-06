import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
    <div className="min-h-screen bg-white w-full lg:px-88">
      <DashboardHeader
        onLogout={handleLogout}
        isLoggingOut={logout.isPending}
        isOnline={isOnline}
      />

      <div className="relative overflow-hidden px-4 text-white sm:px-6 pt-4 lg:pt-8">
        <div className="pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-5xl space-y-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
            <h1 className="mt-3 text-xl lg:text-3xl font-semibold text-ink-900 tracking-tight">
              Hello, {getFirstName(user?.name)}
            </h1>

            <div className="flex w-full max-w-sm flex-col gap-3 lg:shrink-0 lg:items-end">
              <div className="w-full rounded-3xl border border-gray-200 px-5 py-4 text-left sm:text-right">
                <p className="text-[10px] text-ink-900 font-semibold uppercase tracking-[0.35em]">
                  Your net across groups
                </p>
                <p className="mt-2 text-ink-900 text-3xl font-semibold tabular-nums">
                  ₱{formatMoney(totalBalance)}
                </p>
              </div>
              <Button
                size="md"
                aria-label="Add Group"
                className="fixed bottom-4 right-4 z-30 h-14 w-14 rounded-full bg-ink-900 p-0 font-semibold text-white shadow-[0_18px_40px_rgba(15,23,42,0.28)] transition hover:bg-slate-100 sm:static sm:h-11 sm:w-auto sm:px-6 sm:py-3 sm:shadow-lg"
                onClick={() => setIsAddModalOpen(true)}
              >
                <Plus className="h-5 w-5 sm:mr-2 sm:h-4 sm:w-4" />
                <span className="sr-only sm:not-sr-only">Add Group</span>
              </Button>
            </div>
          </div>

        </div>
      </div>

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pt-8 sm:px-6 sm:py-10">
        <section className="flex flex-col gap-4">
          <h2 className="text-base lg:text-lg text-ink-900">Your groups</h2>

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
