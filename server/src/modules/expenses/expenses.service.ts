import { badRequest } from "../../utils/errors.js";
import { assertGroupMember } from "../common/authorization.js";
import { calculateExpenseDetails } from "./expenses.calculations.js";
import { expensesRepository } from "./expenses.repository.js";
import type { ExpenseWriteInput } from "./expenses.schemas.js";

interface PublicExpenseSplit {
  id: string;
  userId: string;
  amountOwed: number;
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

export interface PublicExpense {
  id: string;
  groupId: string;
  titleDescription: string;
  totalAmount: number;
  paidByUserId: string | null;
  saleDate: string;
  taxAmount: number;
  tipAmount: number;
  splitType: string;
  splits: PublicExpenseSplit[];
  receiptItems: PublicReceiptItem[];
  memberDiscounts: PublicMemberDiscount[];
  createdAt: string;
  updatedAt: string;
}

const toPublicExpense = async (
  record: Awaited<ReturnType<typeof expensesRepository.listByGroup>>[number],
): Promise<PublicExpense> => {
  const [splits, items, memberDiscounts] = await Promise.all([
    expensesRepository.listSplits(record.expense_id),
    expensesRepository.listReceiptItems(record.expense_id),
    expensesRepository.listMemberDiscounts(record.expense_id),
  ]);
  return {
    id: String(record.expense_id),
    groupId: String(record.group_id),
    titleDescription: record.title_description,
    totalAmount: Number(record.total_amount),
    paidByUserId: record.payer_user_id ? String(record.payer_user_id) : null,
    saleDate: record.sale_date,
    taxAmount: Number(record.tax_amount),
    tipAmount: Number(record.tip_amount),
    splitType: record.split_type,
    splits: splits.map((split) => ({
      id: String(split.split_id),
      userId: String(split.user_id),
      amountOwed: Number(split.amount_owed),
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
    const expenseId = await expensesRepository.createWithDetails({
      expense: {
        ...input,
        paidByUserId: input.paidByUserId ?? requesterUserId,
      },
      splits: calculated.splits,
      receiptItems: calculated.receiptItems,
      memberDiscounts: calculated.memberDiscounts,
    });
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
    const updated = await expensesRepository.updateWithDetails({
      expenseId,
      expense: {
        ...input,
        paidByUserId: input.paidByUserId ?? requesterUserId,
      },
      splits: calculated.splits,
      receiptItems: calculated.receiptItems,
      memberDiscounts: calculated.memberDiscounts,
    });
    if (!updated) {
      throw badRequest("Expense not found", "expense_not_found");
    }
  },

  async remove(expenseId: number, requesterUserId: number): Promise<void> {
    const groupId = await expensesRepository.findGroupIdByExpenseId(expenseId);
    if (!groupId) {
      throw badRequest("Expense not found", "expense_not_found");
    }
    await assertGroupMember(requesterUserId, groupId);
    const deleted = await expensesRepository.deleteById(expenseId);
    if (!deleted) {
      throw badRequest("Expense not found", "expense_not_found");
    }
  },
};
