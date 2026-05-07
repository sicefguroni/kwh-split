import type { NextFunction, Request, Response } from "express";
import { getAuthenticatedUserId } from "../../middleware/require-auth.js";
import { parsePositiveInt, parseSubjectUserId } from "../common/authorization.js";
import { expensesService } from "./expenses.service.js";
import type { ExpenseWriteInput } from "./expenses.schemas.js";

type TypedBody<T> = Request<Record<string, string>, unknown, T>;

export const expensesController = {
  async create(
    req: TypedBody<ExpenseWriteInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));
      const expenseId = await expensesService.create(req.body, userId);
      res.status(201).json({ expenseId });
    } catch (error) {
      next(error);
    }
  },

  async listByGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));
      const groupId = parsePositiveInt(req.params.groupId ?? "", "groupId");
      const expenses = await expensesService.listByGroup(groupId, userId);
      res.status(200).json({ expenses });
    } catch (error) {
      next(error);
    }
  },

  async update(
    req: TypedBody<ExpenseWriteInput> & Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));
      const expenseId = parsePositiveInt(req.params.id ?? "", "id");
      await expensesService.update(expenseId, req.body, userId);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },

  async remove(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));
      const expenseId = parsePositiveInt(req.params.id ?? "", "id");
      await expensesService.remove(expenseId, userId);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },
};
