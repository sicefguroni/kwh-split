import { useMemo, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AddGroupModal, EditGroupModal, type GroupFormSubmission } from "@/components/dashboard/add-group-modal";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { EmptyGroupsState } from "@/components/dashboard/empty-groups-state";
import { GroupCard } from "@/components/dashboard/group-card";
import { Button } from "@/components/ui/button";
import { useCurrentUser, useLogoutMutation } from "@/features/auth/use-auth";
import { expensesApi } from "@/features/expenses/api";
import type { ApiExpense } from "@/features/expenses/types";
import { groupsApi } from "@/features/groups/api";
import {
  useCreateGroupMutation,
  useDeleteGroupMutation,
  useGroupsQuery,
  useUpdateGroupMutation,
} from "@/features/groups/use-groups";
import { useOnlineStatus } from "@/hooks/use-persistent-state";
import type { GroupData } from "@/hooks/use-groups";
import { ApiError } from "@/lib/api-client";
import { resolveViewerMemberId } from "@/lib/group-money";

const getFirstName = (fullName: string | undefined): string => fullName?.split(" ")[0] ?? "there";

function formatMoney(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function describeInviteOutcome(
  baseMessage: string,
  inviteResult: Awaited<ReturnType<typeof groupsApi.createInvitations>> | null,
): string {
  if (!inviteResult) {
    return baseMessage;
  }
  if (inviteResult.created.length === 0 && inviteResult.skipped.length > 0) {
    return `${baseMessage} No invitations were sent: ${inviteResult.skipped[0]?.reason ?? "all recipients were skipped."}`;
  }
  if (inviteResult.created.length > 0 && inviteResult.skipped.length > 0) {
    return `${baseMessage} ${inviteResult.created.length} invite${inviteResult.created.length === 1 ? "" : "s"} sent, ${inviteResult.skipped.length} skipped.`;
  }
  if (inviteResult.created.length > 0) {
    return `${baseMessage} ${inviteResult.created.length} invite${inviteResult.created.length === 1 ? "" : "s"} sent.`;
  }
  return baseMessage;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const logout = useLogoutMutation();
  const createGroupMutation = useCreateGroupMutation();
  const updateGroupMutation = useUpdateGroupMutation();
  const deleteGroupMutation = useDeleteGroupMutation();
  const { data: apiGroups = [] } = useGroupsQuery();
  const isOnline = useOnlineStatus();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupData | null>(null);
  const [actionMessage, setActionMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [deletedGroupNotification, setDeletedGroupNotification] = useState<string | null>(null);

  const groups: GroupData[] = useMemo(
    () =>
      apiGroups.map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description ?? "",
        currency: group.currency,
        imageUrl: group.imageUrl ?? undefined,
        members: group.members,
        balance: 0,
        createdAt: group.createdAt,
        role: group.role,
      })),
    [apiGroups],
  );

  const expenseQueries = useQueries({
    queries: groups.map((group) => ({
      queryKey: ["expenses", group.id],
      queryFn: async (): Promise<ApiExpense[]> => {
        const { expenses } = await expensesApi.listByGroup(group.id);
        return expenses;
      },
      enabled: group.id.length > 0,
    })),
  });

  const groupsWithBalance: GroupData[] = useMemo(
    () =>
      groups.map((group, index) => {
        const expenses = expenseQueries[index]?.data ?? [];
        const viewerId = resolveViewerMemberId(group, user?.name, user?.id);
        if (!viewerId) {
          return { ...group, balance: 0 };
        }

        const net = expenses.reduce((sum, expense) => {
          const payerId = expense.paidByUserId;
          if (!payerId) return sum;

          if (payerId === viewerId) {
            const othersUnsettled = expense.splits
              .filter((split) => split.userId !== viewerId && !split.isSettled)
              .reduce((subtotal, split) => subtotal + split.amountOwed, 0);
            return sum + othersUnsettled;
          }

          const viewerSplit = expense.splits.find(
            (split) => split.userId === viewerId && !split.isSettled,
          );
          return sum - (viewerSplit?.amountOwed ?? 0);
        }, 0);

        return {
          ...group,
          balance: Number(net.toFixed(2)),
        };
      }),
    [expenseQueries, groups, user?.id, user?.name],
  );

  const totalBalance = useMemo(
    () => groupsWithBalance.reduce((sum, group) => sum + group.balance, 0),
    [groupsWithBalance],
  );

  const handleLogout = async (): Promise<void> => {
    await logout.mutateAsync();
    navigate("/login", { replace: true });
  };

  const handleSaveGroup = async (group: GroupFormSubmission): Promise<void> => {
    setIsSavingGroup(true);
    try {
      if (editingGroup) {
        const updatedGroup = await updateGroupMutation.mutateAsync({
          id: editingGroup.id,
          name: group.name,
          description: group.description,
          currency: group.currency,
          imageUrl: group.imageUrl,
        });

        const inviteResult =
          group.inviteRecipients.length > 0
            ? await groupsApi.createInvitations(updatedGroup.id, {
              recipients: group.inviteRecipients.map((recipient) =>
                recipient.userId
                  ? { userId: Number(recipient.userId) }
                  : { email: recipient.email },
              ),
            })
            : null;

        if (inviteResult) {
          await queryClient.invalidateQueries({ queryKey: ["group-invitations", updatedGroup.id] });
          await queryClient.invalidateQueries({ queryKey: ["incoming-invitations"] });
        }

        setActionMessage({
          kind: "success",
          text: describeInviteOutcome("Group updated.", inviteResult),
        });
      } else {
        const createdGroup = await createGroupMutation.mutateAsync({
          name: group.name,
          description: group.description,
          currency: group.currency,
          imageUrl: group.imageUrl,
        });

        const inviteResult =
          group.inviteRecipients.length > 0
            ? await groupsApi.createInvitations(createdGroup.id, {
              recipients: group.inviteRecipients.map((recipient) =>
                recipient.userId
                  ? { userId: Number(recipient.userId) }
                  : { email: recipient.email },
              ),
            })
            : null;

        if (inviteResult) {
          await queryClient.invalidateQueries({ queryKey: ["group-invitations", createdGroup.id] });
          await queryClient.invalidateQueries({ queryKey: ["incoming-invitations"] });
        }

        setActionMessage({
          kind: "success",
          text: describeInviteOutcome("Group created.", inviteResult),
        });
      }

      setEditingGroup(null);
      setIsAddModalOpen(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        navigate("/login", { replace: true });
        throw error;
      }

      throw error;
    } finally {
      setIsSavingGroup(false);
    }
  };

  const handleOpenCreateGroup = () => {
    setEditingGroup(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditGroup = (group: GroupData) => {
    setEditingGroup(group);
    setIsAddModalOpen(true);
  };

  const handleDeleteGroup = async (group: GroupData): Promise<void> => {
    const confirmed = window.confirm(`Delete "${group.name}"? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await deleteGroupMutation.mutateAsync({ id: group.id });
      setDeletedGroupNotification(`Group "${group.name}" deleted.`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setActionMessage({ kind: "error", text: "Session expired. Please log in again." });
        navigate("/login", { replace: true });
        return;
      }

      setActionMessage({
        kind: "error",
        text: error instanceof ApiError ? error.message : "Unable to delete group.",
      });
    }
  };

  return (
    <div className="min-h-screen w-full bg-white">
      <DashboardHeader
        onLogout={handleLogout}
        isLoggingOut={logout.isPending}
        isOnline={isOnline}
        actionMessage={actionMessage}
        onDismissAction={() => setActionMessage(null)}
        deletedGroupNotification={deletedGroupNotification}
        onDismissDeletedNotification={() => setDeletedGroupNotification(null)}
      />

      <div className="relative overflow-hidden pt-4 text-white lg:pt-8">
        <div className="pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative mx-auto w-full max-w-3xl space-y-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
            <h1 className="mt-3 mx-4 text-xl font-semibold tracking-tight text-ink-900 lg:text-3xl">
              Hello, {getFirstName(user?.name)}
            </h1>

            <div className="lg:mx-4 flex w-full max-w-sm flex-col gap-3 lg:shrink-0 lg:items-end">
              <div className="w-full rounded-3xl border border-gray-200 px-5 py-4 text-left sm:text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-ink-900">
                  Your net across groups
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-ink-900">
                  ₱{formatMoney(totalBalance)}
                </p>
              </div>
              <Button
                size="md"
                aria-label="Add Group"
                className="fixed bottom-4 right-4 z-30 h-14 w-14 rounded-full bg-ink-900 p-0 font-semibold text-white shadow-[0_18px_40px_rgba(15,23,42,0.28)] transition hover:bg-ink-800 sm:static sm:h-11 sm:w-auto sm:px-6 sm:py-3 sm:shadow-lg"
                onClick={handleOpenCreateGroup}
              >
                <Plus className="h-5 w-5 sm:mr-2 sm:h-4 sm:w-4" />
                <span className="sr-only sm:not-sr-only">Add Group</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-6 sm:px-6 sm:py-10">
        <section className="flex flex-col gap-4">
          <h2 className="text-base text-ink-900 lg:text-lg">Your groups</h2>

          <section aria-labelledby="groups-heading" className="flex flex-col gap-4">
            {groupsWithBalance.length === 0 ? (
              <EmptyGroupsState onCreate={handleOpenCreateGroup} />
            ) : (
              groupsWithBalance.map((group) => (
                <GroupCard
                  key={group.id}
                  {...group}
                  onEdit={
                    group.role === "admin"
                      ? () => handleOpenEditGroup(group)
                      : undefined
                  }
                  onDelete={
                    group.role === "admin"
                      ? () => {
                        void handleDeleteGroup(group);
                      }
                      : undefined
                  }
                />
              ))
            )}
          </section>
        </section>
      </main>

      {editingGroup ? (
        <EditGroupModal
          isOpen={isAddModalOpen}
          onClose={() => {
            setEditingGroup(null);
            setIsAddModalOpen(false);
          }}
          onSubmit={(group) => {
            return handleSaveGroup(group);
          }}
          initialData={editingGroup}
          isSubmitting={isSavingGroup}
        />
      ) : (
        <AddGroupModal
          isOpen={isAddModalOpen}
          onClose={() => {
            setEditingGroup(null);
            setIsAddModalOpen(false);
          }}
          onSubmit={(group) => {
            return handleSaveGroup(group);
          }}
          isSubmitting={isSavingGroup}
        />
      )}
    </div>
  );
}
