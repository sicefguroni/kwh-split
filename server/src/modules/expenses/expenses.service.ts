import { badRequest } from "../../utils/errors.js";
import { assertGroupMember } from "../common/authorization.js";
import { calculateExpenseDetails } from "./expenses.calculations.js";
import { expensesRepository } from "./expenses.repository.js";
import { groupsRepository } from "../groups/groups.repository.js";
import { userRepository } from "../auth/auth.repository.js";
import { broadcastGroupChange, broadcastInvitationChange } from "../realtime/realtime-hub.js";
import { displayName } from "../../utils/display-name.js";
import type { ExpenseWriteInput } from "./expenses.schemas.js";

interface PublicExpenseSplit {
  id: string;
  userId: string;
  amountOwed: number;
  originalAmount: number | null;
  percentage: number | null;
  share: number | null;
  isSettled: boolean;
}

interface PublicReceiptItem {
  id: string;
  itemName: string;
  price: number;
  assignedUserIds: string[];
}

interface PublicMemberDiscount {
  id: string;
  userId: string;
  type: string;
  ratePercent: number;
}

export interface PublicPayerEntry {
  userId: string;
  amountPaid: number;
}

export interface PublicExpense {
  id: string;
  groupId: string;
  titleDescription: string;
  totalAmount: number;
  paidByUserId: string | null;
  payerAmounts: PublicPayerEntry[];
  saleDate: string;
  taxAmount: number;
  tipAmount: number;
  splitType: string;
  category: string;
  note: string;
  splits: PublicExpenseSplit[];
  receiptItems: PublicReceiptItem[];
  memberDiscounts: PublicMemberDiscount[];
  createdAt: string;
  updatedAt: string;
}

const toPublicExpense = async (
  record: Awaited<ReturnType<typeof expensesRepository.listByGroup>>[number],
): Promise<PublicExpense> => {
  const [splits, items, memberDiscounts, payers] = await Promise.all([
    expensesRepository.listSplits(record.expense_id),
    expensesRepository.listReceiptItems(record.expense_id),
    expensesRepository.listMemberDiscounts(record.expense_id),
    expensesRepository.listPayerEntries(record.expense_id),
  ]);
  return {
    id: String(record.expense_id),
    groupId: String(record.group_id),
    titleDescription: record.title_description,
    totalAmount: Number(record.total_amount),
    paidByUserId: record.payer_user_id ? String(record.payer_user_id) : null,
    payerAmounts: payers.map((p) => ({
      userId: String(p.user_id),
      amountPaid: Number(p.amount_paid),
    })),
    saleDate: record.sale_date,
    taxAmount: Number(record.tax_amount),
    tipAmount: Number(record.tip_amount),
    splitType: record.split_type,
    category: record.category ?? "General",
    note: record.note ?? "",
    splits: splits.map((split) => ({
      id: String(split.split_id),
      userId: String(split.user_id),
      amountOwed: Number(split.amount_owed),
      originalAmount: split.original_amount !== null ? Number(split.original_amount) : null,
      percentage: split.percentage !== null ? Number(split.percentage) : null,
      share: split.share !== null ? Number(split.share) : null,
      isSettled: split.is_settled,
    })),
    receiptItems: items.map((item) => ({
      id: String(item.item_id),
      itemName: item.item_name,
      price: Number(item.price),
      assignedUserIds: item.assigned_user_ids.map(String),
    })),
    memberDiscounts: memberDiscounts.map((item) => ({
      id: String(item.expense_member_discount_id),
      userId: String(item.user_id),
      type: item.discount_type,
      ratePercent: Number(item.rate_percent),
    })),
    createdAt: record.created_at.toISOString(),
    updatedAt: record.updated_at.toISOString(),
  };
};

export const expensesService = {
  async create(input: ExpenseWriteInput, requesterUserId: number): Promise<string> {
    await assertGroupMember(requesterUserId, input.groupId);
    const groupMemberIds = await expensesRepository.listGroupMemberIds(input.groupId);
    const calculated = calculateExpenseDetails(input, groupMemberIds);
    // Resolve payers: if payerUserIds not provided, fallback to paidByUserId or requester
    const resolvedPayers = input.payerUserIds ?? [
      { userId: input.paidByUserId ?? requesterUserId, amountPaid: input.totalAmount },
    ];
    const expenseId = await expensesRepository.createWithDetails({
      expense: {
        ...input,
        paidByUserId: input.paidByUserId ?? requesterUserId,
        payerUserIds: resolvedPayers,
      },
      splits: calculated.splits,
      receiptItems: calculated.receiptItems,
      memberDiscounts: calculated.memberDiscounts,
    });
    broadcastGroupChange(input.groupId);

    void (async () => {
      try {
        const [members, user, group] = await Promise.all([
          groupsRepository.listMembers(input.groupId),
          userRepository.findById(requesterUserId),
          groupsRepository.findById(input.groupId),
        ]);
        if (!user || !group) return;
        const userName = displayName(user, members);
        const title = input.titleDescription;
        const amount = `${group.currency} ${Number(input.totalAmount).toFixed(2)}`;
        for (const m of members) {
          if (m.user_id === requesterUserId) continue;
          await groupsRepository.createNotification({
            groupId: input.groupId,
            userId: m.user_id,
            type: "expense_added",
            title: "New expense added",
            message: `${userName} added ${title} (${amount}) in ${group.name}.`,
          });
          broadcastInvitationChange(m.user_id);
        }
      } catch { /* fire-and-forget */ }
    })();

    return String(expenseId);
  },

  async listByGroup(groupId: number, requesterUserId: number): Promise<PublicExpense[]> {
    await assertGroupMember(requesterUserId, groupId);
    const records = await expensesRepository.listByGroup(groupId);
    return Promise.all(records.map((record) => toPublicExpense(record)));
  },

  async update(expenseId: number, input: ExpenseWriteInput, requesterUserId: number): Promise<void> {
    await assertGroupMember(requesterUserId, input.groupId);
    const belongs = await expensesRepository.belongsToGroup(expenseId, input.groupId);
    if (!belongs) {
      throw badRequest("Expense not found", "expense_not_found");
    }
    const groupMemberIds = await expensesRepository.listGroupMemberIds(input.groupId);
    const calculated = calculateExpenseDetails(input, groupMemberIds);
    const resolvedPayers = input.payerUserIds ?? [
      { userId: input.paidByUserId ?? requesterUserId, amountPaid: input.totalAmount },
    ];
    const updated = await expensesRepository.updateWithDetails({
      expenseId,
      expense: {
        ...input,
        paidByUserId: input.paidByUserId ?? requesterUserId,
        payerUserIds: resolvedPayers,
      },
      splits: calculated.splits,
      receiptItems: calculated.receiptItems,
      memberDiscounts: calculated.memberDiscounts,
    });
    if (!updated) {
      throw badRequest("Expense not found", "expense_not_found");
    }
    broadcastGroupChange(input.groupId);
  },

  async remove(expenseId: number, requesterUserId: number): Promise<void> {
    const expense = await expensesRepository.findById(expenseId);
    if (!expense) {
      throw badRequest("Expense not found", "expense_not_found");
    }
    const groupId = expense.group_id;
    await assertGroupMember(requesterUserId, groupId);
    const deleted = await expensesRepository.deleteById(expenseId);
    if (!deleted) {
      throw badRequest("Expense not found", "expense_not_found");
    }
    broadcastGroupChange(groupId);

    void (async () => {
      try {
        const [members, user, group] = await Promise.all([
          groupsRepository.listMembers(groupId),
          userRepository.findById(requesterUserId),
          groupsRepository.findById(groupId),
        ]);
        if (!user || !group) return;
        const userName = displayName(user, members);
        const title = expense.title_description;
        for (const m of members) {
          if (m.user_id === requesterUserId) continue;
          await groupsRepository.createNotification({
            groupId,
            userId: m.user_id,
            type: "expense_deleted",
            title: "Expense removed",
            message: `${userName} removed ${title} from ${group.name}.`,
          });
          broadcastInvitationChange(m.user_id);
        }
      } catch { /* fire-and-forget */ }
    })();
  },
};
