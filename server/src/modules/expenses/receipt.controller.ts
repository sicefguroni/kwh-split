import type { NextFunction, Request, Response } from "express";
import { getAuthenticatedUserId } from "../../middleware/require-auth.js";
import { assertGroupMember, parsePositiveInt, parseSubjectUserId } from "../common/authorization.js";
import { receiptService } from "./receipt.service.js";
import { expensesRepository } from "./expenses.repository.js";
import { badRequest } from "../../utils/errors.js";
import { broadcastGroupChange } from "../realtime/realtime-hub.js";

type TypedBody<T> = Request<Record<string, string>, unknown, T>;

export const receiptController = {
  async uploadReceipt(
    req: Request<{ expenseId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const expenseId = parsePositiveInt(req.params.expenseId ?? "", "expenseId");
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));

      const groupId = await expensesRepository.findGroupIdByExpenseId(expenseId);
      if (!groupId) {
        throw badRequest("Expense not found", "expense_not_found");
      }

      await assertGroupMember(userId, groupId);

      if (!req.file) {
        throw badRequest("No receipt image uploaded", "missing_file");
      }

      const items = await receiptService.processReceiptImage(expenseId, req.file.buffer);

      // Notify clients
      broadcastGroupChange(groupId);

      res.status(200).json({ success: true, items });
    } catch (error) {
      next(error);
    }
  },

  async assignItems(
    req: TypedBody<{ assignments: Array<{ itemId: number; assignedUserIds: number[] }> }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));
      const expenseId = parsePositiveInt(req.params.expenseId ?? "", "expenseId");

      // Verify user is in the group that owns this expense
      const groupId = await expensesRepository.findGroupIdByExpenseId(expenseId);
      if (!groupId) {
        throw badRequest("Expense not found", "expense_not_found");
      }

      await assertGroupMember(userId, groupId);

      const groupMemberIds = new Set(await expensesRepository.listGroupMemberIds(groupId));
      for (const assignment of req.body.assignments) {
        for (const assignedUserId of assignment.assignedUserIds) {
          if (!groupMemberIds.has(assignedUserId)) {
            throw badRequest("Assigned user is not a member of this group", "validation_error");
          }
        }
      }

      // Assign items and get calculated splits
      const splits = await receiptService.assignReceiptItems(expenseId, req.body);

      // Update expense splits in database
      await expensesRepository.replaceExpenseSplits(expenseId, splits);
      broadcastGroupChange(groupId);

      res.status(200).json({ success: true, splits });
    } catch (error) {
      next(error);
    }
  },

  async getItems(
    req: Request<{ expenseId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));
      const expenseId = parsePositiveInt(req.params.expenseId ?? "", "expenseId");

      // Verify expense exists
      const groupId = await expensesRepository.findGroupIdByExpenseId(expenseId);
      if (!groupId) {
        throw badRequest("Expense not found", "expense_not_found");
      }

      await assertGroupMember(userId, groupId);

      const items = await receiptService.getReceiptItemsForExpense(expenseId);
      res.status(200).json({ items });
    } catch (error) {
      next(error);
    }
  },

  async extractReceiptPreview(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    console.log("extractReceiptPreview called");
    try {
      if (!req.file) {
        throw badRequest("No receipt image uploaded", "missing_file");
      }

      const items = await receiptService.extractReceiptPreview(req.file.buffer);
      res.status(200).json({ success: true, items });
    } catch (error) {
      next(error);
    }
  },
};
