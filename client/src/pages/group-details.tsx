import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Edit3, MoreVertical, Plus, Trash2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddExpenseModal } from "@/components/expenses/add-expense-modal";
import { EditGroupModal } from "@/components/dashboard/add-group-modal";
import { GroupAvatar, GroupCoverBackground } from "@/components/dashboard/group-media";
import { useOnlineStatus } from "@/hooks/use-persistent-state";
import { type GroupData, type GroupExpense } from "@/hooks/use-groups";
import { useCurrentUser } from "@/features/auth/use-auth";
import { useGroupQuery } from "@/features/groups/use-groups";
import {
  useCreateExpenseMutation,
  useDeleteExpenseMutation,
  useExpensesQuery,
  useUpdateExpenseMutation,
} from "@/features/expenses/use-expenses";
import {
  useMarkSettlementPaidMutation,
  useSettlementHistoryQuery,
} from "@/features/settlements/use-settlements";
import {
  resolveViewerMemberId,
  totalSpent,
} from "@/lib/group-money";
import { cn } from "@/lib/cn";

const EXPENSE_MENU_WIDTH = 152;
const EXPENSE_MENU_HEIGHT = 96;
const EXPENSE_MENU_OFFSET = 8;
const EXPENSE_MENU_MARGIN = 12;

export default function GroupDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const groupId = id ?? "";
  const { data: apiGroup } = useGroupQuery(groupId);
  const { data: apiExpenses = [] } = useExpensesQuery(groupId);
  const { data: settlementHistory = [] } = useSettlementHistoryQuery(groupId);
  const markPaidMutation = useMarkSettlementPaidMutation(groupId);
  const createExpenseMutation = useCreateExpenseMutation(groupId);
  const updateExpenseMutation = useUpdateExpenseMutation(groupId);
  const deleteExpenseMutation = useDeleteExpenseMutation(groupId);
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
  const [activeTab, setActiveTab] = useState<"expenses" | "balances" | "members">("expenses");
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<GroupExpense | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const touchStartX = useRef<number>(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const isOnline = useOnlineStatus();
  const { data: user } = useCurrentUser();

  const totalSpentValue = useMemo(() => totalSpent(expenses), [expenses]);

  const pendingCount = useMemo(() => 0, []);

  const viewerNet = useMemo(() => {
    if (!group) return 0;
    const viewerId = resolveViewerMemberId(group, user?.name, user?.id);
    if (!viewerId) return 0;
    return apiExpenses.reduce((sum, expense) => {
      const payerId = expense.paidByUserId;
      if (!payerId) return sum;
      if (payerId === viewerId) {
        const othersUnsettled = expense.splits
          .filter((split) => split.userId !== viewerId && !split.isSettled)
          .reduce((acc, split) => acc + split.amountOwed, 0);
        return sum + othersUnsettled;
      }
      const viewerSplit = expense.splits.find((split) => split.userId === viewerId && !split.isSettled);
      return sum - (viewerSplit?.amountOwed ?? 0);
    }, 0);
  }, [apiExpenses, group, user?.id, user?.name]);

  const balancesWithOthers = useMemo(() => {
    if (!group) return [];
    const viewerId = resolveViewerMemberId(group, user?.name, user?.id);
    if (!viewerId) return [];
    return group.members
      .filter((member) => member.id !== viewerId)
      .map((member) => {
        const netOwesYou = apiExpenses.reduce((sum, expense) => {
          const payerId = expense.paidByUserId;
          if (!payerId) return sum;
          if (payerId === viewerId) {
            const memberSplit = expense.splits.find(
              (split) => split.userId === member.id && !split.isSettled,
            );
            return sum + (memberSplit?.amountOwed ?? 0);
          }
          if (payerId === member.id) {
            const viewerSplit = expense.splits.find(
              (split) => split.userId === viewerId && !split.isSettled,
            );
            return sum - (viewerSplit?.amountOwed ?? 0);
          }
          return sum;
        }, 0);
        return {
          id: member.id,
          name: member.name,
          netOwesYou: Number(netOwesYou.toFixed(2)),
        };
      });
  }, [apiExpenses, group, user?.id, user?.name]);

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
    if (!openMenuId) {
      setMenuPosition(null);
      return;
    }

    const updateMenuPosition = () => {
      const trigger = menuButtonRefs.current[openMenuId];
      if (!trigger) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - EXPENSE_MENU_MARGIN;
      const openUpward =
        spaceBelow < EXPENSE_MENU_HEIGHT && rect.top > EXPENSE_MENU_HEIGHT + EXPENSE_MENU_MARGIN;
      const top = openUpward
        ? Math.max(EXPENSE_MENU_MARGIN, rect.top - EXPENSE_MENU_HEIGHT - EXPENSE_MENU_OFFSET)
        : Math.min(
            rect.bottom + EXPENSE_MENU_OFFSET,
            window.innerHeight - EXPENSE_MENU_HEIGHT - EXPENSE_MENU_MARGIN,
          );
      const left = Math.min(
        Math.max(EXPENSE_MENU_MARGIN, rect.right - EXPENSE_MENU_WIDTH),
        window.innerWidth - EXPENSE_MENU_WIDTH - EXPENSE_MENU_MARGIN,
      );

      setMenuPosition({ top, left });
    };

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      const trigger = menuButtonRefs.current[openMenuId];
      if (target && !menuRef.current?.contains(target) && !trigger?.contains(target)) {
        setOpenMenuId(null);
      }
    };

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenuId(null);
      }
    };

    updateMenuPosition();

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("touchstart", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [openMenuId]);

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
    void updated;
    setIsEditGroupOpen(false);
  };

  const toExpensePayload = (expense: GroupExpense) => ({
    groupId: Number(groupId),
    titleDescription: expense.name,
    totalAmount: expense.amount,
    paidByUserId: Number(expense.paidBy),
    saleDate: expense.date,
    taxAmount: 0,
    tipAmount: 0,
    splitType: "exact" as const,
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

  const handleAddExpense = async (expense: GroupExpense) => {
    await createExpenseMutation.mutateAsync(toExpensePayload(expense));
    setSelectedExpense(null);
    setIsAddExpenseOpen(false);
  };

  const handleEditExpense = async (expense: GroupExpense) => {
    await updateExpenseMutation.mutateAsync({
      expenseId: expense.id,
      payload: toExpensePayload(expense),
    });
    setSelectedExpense(null);
    setIsAddExpenseOpen(false);
  };

  const handleOpenEditExpense = (expense: GroupExpense) => {
    setSelectedExpense(expense);
    setIsAddExpenseOpen(true);
    setOpenMenuId(null);
  };

  const handleDeleteExpense = async (expenseId: string) => {
    await deleteExpenseMutation.mutateAsync({ expenseId });
    setOpenMenuId(null);
    setSwipedId(null);
  };

  const toggleExpenseMenu = (expenseId: string) => {
    setOpenMenuId((currentId) => (currentId === expenseId ? null : expenseId));
  };

  const handleTouchStart = (e: React.TouchEvent, expenseId: string) => {
    if (e.touches.length > 0) touchStartX.current = e.touches[0]!.clientX;
    if (swipedId && swipedId !== expenseId) setSwipedId(null);
  };

  const handleTouchEnd = (e: React.TouchEvent, expenseId: string) => {
    if (e.changedTouches.length === 0) return;
    const dx = touchStartX.current - e.changedTouches[0]!.clientX;
    if (dx > 48) setSwipedId(expenseId);
    else if (dx < -24) setSwipedId(null);
  };

  const openMenuExpense = openMenuId
    ? expenses.find((expense) => expense.id === openMenuId) ?? null
    : null;
  const handleMarkPaid = async (
    viewerId: string,
    otherUserId: string,
    netOwesYou: number,
  ) => {
    const absoluteAmount = Number(Math.abs(netOwesYou).toFixed(2));
    if (absoluteAmount <= 0) return;
    if (netOwesYou > 0) {
      await markPaidMutation.mutateAsync({
        fromUserId: Number(otherUserId),
        toUserId: Number(viewerId),
        amount: absoluteAmount,
      });
      return;
    }
    await markPaidMutation.mutateAsync({
      fromUserId: Number(viewerId),
      toUserId: Number(otherUserId),
      amount: absoluteAmount,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="relative overflow-hidden text-white">
        <GroupCoverBackground
          name={group.name}
          imageUrl={group.imageUrl}
          className="absolute inset-0"
          overlayClassName="bg-linear-to-br from-slate-950/92 via-slate-900/75 to-sky-900/65"
        />
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
                {!isOnline ? (
                  <span
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15"
                    title="Offline"
                    aria-label="Offline"
                  >
                    <WifiOff className="h-4 w-4" aria-hidden />
                  </span>
                ) : null}
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

          {/* Group identity — mobile: large image + stacked text + full-width button */}
          {/* desktop: compact inline row */}
          <div className="mt-5">
            {/* Shared image + text row */}
            <div className="flex items-center gap-4">
              <GroupAvatar
                name={group.name}
                imageUrl={group.imageUrl}
                className="h-24 w-24 flex-shrink-0 rounded-3xl shadow-lg ring-2 ring-white/20 sm:h-16 sm:w-16 sm:rounded-2xl"
                fallbackClassName="text-lg sm:text-sm"
              />
              <div className="min-w-0 flex-1">
                <h1 className="text-xl lg:2xl font-bold uppercase tracking-wide text-white sm:truncate ">
                  {group.name}
                </h1>
                <p className="mt-1 text-sm text-slate-300/80 sm:mt-0.5 sm:text-xs">Group Total</p>
                <p className="text-xl lg:2xl font-semibold text-white">
                  {group.currency}
                  {totalSpentValue.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              {/* Desktop-only inline Add Expense button */}
              <div className="hidden flex-shrink-0 sm:block">
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

            {/* Mobile-only full-width Add Expense button */}
            <div className="mt-5 sm:hidden">
              <Button
                className="w-full rounded-full bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-black"
                onClick={() => {
                  setSelectedExpense(null);
                  setIsAddExpenseOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Add Expense
              </Button>
            </div>
          </div>

          {pendingCount > 0 && (
            <p className="mt-3 text-xs font-medium text-amber-200/95">
              {pendingCount} item{pendingCount !== 1 ? "s" : ""} not synced yet
            </p>
          )}

          {/* Horizontal tabs */}
          <div className="mt-6 grid grid-cols-3 items-end gap-1">
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
                  "flex min-w-0 items-center justify-center gap-1 rounded-t-[1.35rem] px-1.5 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] transition sm:gap-1.5 sm:px-4 sm:text-xs sm:tracking-widest",
                  activeTab === tab.id
                    ? "border border-b-0 border-white/18 bg-white/18 text-white shadow-[0_-8px_24px_rgba(15,23,42,0.16)] backdrop-blur-md"
                    : "text-slate-400 hover:text-white/70",
                )}
              >
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums sm:text-[10px]",
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
                    const vid = resolveViewerMemberId(group, user?.name, user?.id);
                    const viewerIsPayee = vid === expense.paidBy;
                    const viewerSplit = vid ? expense.splits.find((s) => s.memberId === vid) : undefined;
                    const isLast = idx === items.length - 1;
                    const isSwiped = swipedId === expense.id;
                    return (
                      <div
                        key={expense.id}
                        className={cn(
                          "relative overflow-hidden bg-white",
                          openMenuId === expense.id && "z-20",
                          !isLast && "border-b border-slate-100",
                        )}
                      >
                        {/* Swipe action buttons — mobile only */}
                        <div className="absolute inset-y-0 right-0 flex sm:hidden">
                          <button
                            type="button"
                            onClick={() => handleOpenEditExpense(expense)}
                            className="flex w-16 items-center justify-center bg-sky-500 text-white transition hover:bg-sky-600"
                            aria-label="Edit expense"
                          >
                            <Edit3 className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="flex w-16 items-center justify-center bg-slate-900 text-white transition hover:bg-black"
                            aria-label="Delete expense"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>

                        {/* Swipeable card content */}
                        <div
                          className="relative flex items-center gap-4 bg-white px-4 py-3 transition-transform duration-200 ease-out"
                          style={{ transform: isSwiped ? "translateX(-128px)" : "translateX(0)" }}
                          onTouchStart={(e) => handleTouchStart(e, expense.id)}
                          onTouchEnd={(e) => handleTouchEnd(e, expense.id)}
                          onClick={() => isSwiped && setSwipedId(null)}
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

                          {/* Three-dot menu — desktop only */}
                          <div className="relative hidden flex-shrink-0 sm:block">
                            <button
                              ref={(node) => {
                                menuButtonRefs.current[expense.id] = node;
                              }}
                              type="button"
                              onClick={() => toggleExpenseMenu(expense.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                              aria-label="Expense options"
                              aria-expanded={openMenuId === expense.id}
                              aria-haspopup="menu"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </div>
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
                                onClick={() => {
                                  void handleDeleteExpense(expense.id);
                                }}
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

        {openMenuExpense && menuPosition && typeof document !== "undefined"
          ? createPortal(
              <div
                ref={menuRef}
                className="fixed z-30 min-w-[152px] rounded-2xl border border-slate-200 bg-white py-1 shadow-lg"
                style={{ top: menuPosition.top, left: menuPosition.left }}
                role="menu"
              >
                <button
                  type="button"
                  onClick={() => handleOpenEditExpense(openMenuExpense)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  role="menuitem"
                >
                  <Edit3 className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteExpense(openMenuExpense.id)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  role="menuitem"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>,
              document.body,
            )
          : null}

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
                        const viewerId = group ? resolveViewerMemberId(group, user?.name, user?.id) : undefined;
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
                              {!settled && viewerId ? (
                                <button
                                  type="button"
                                  className="ml-3 rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                  disabled={markPaidMutation.isPending}
                                  onClick={() => {
                                    void handleMarkPaid(viewerId, row.id, row.netOwesYou);
                                  }}
                                >
                                  Mark paid
                                </button>
                              ) : null}
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

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Settlement history</h3>
              {settlementHistory.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No settlements recorded yet.</p>
              ) : (
                <div className="mt-4 space-y-2">
                  {settlementHistory.slice(0, 10).map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-slate-700">
                          #{entry.id} {entry.fromUserName} paid {entry.toUserName}
                          {entry.note ? ` for ${entry.note.replace(/^For:\s*/i, "")}` : ""}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {new Date(entry.paidAt).toLocaleString()}
                          {entry.reference ? ` • Ref: ${entry.reference}` : ""}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {group.currency}
                        {entry.amountPaid.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MEMBERS */}
        {activeTab === "members" && (
          <div className="">
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
        onSubmit={(expense) => {
          if (selectedExpense) {
            void handleEditExpense(expense);
            return;
          }
          void handleAddExpense(expense);
        }}
        initialData={selectedExpense ?? undefined}
        members={group.members}
        currency={group.currency}
        groupName={group.name}
      />

      <EditGroupModal
        isOpen={isEditGroupOpen}
        onClose={() => setIsEditGroupOpen(false)}
        onSubmit={handleSaveGroup}
        initialData={group}
      />
    </div>
  );
}