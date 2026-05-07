import type { NextFunction, Request, Response } from "express";
import { getAuthenticatedUserId } from "../../middleware/require-auth.js";
import { parsePositiveInt, parseSubjectUserId } from "../common/authorization.js";
import { settlementsService } from "./settlements.service.js";
import type { MarkPaidInput } from "./settlements.schemas.js";

type TypedBody<T> = Request<unknown, unknown, T>;

export const settlementsController = {
  async dashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));
      const groupId = parsePositiveInt(req.params.groupId ?? "", "groupId");
      const dashboard = await settlementsService.getDashboard(groupId, userId);
      res.status(200).json({ dashboard });
    } catch (error) {
      next(error);
    }
  },

  async markPaid(
    req: TypedBody<MarkPaidInput> & Request<{ groupId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));
      const groupId = parsePositiveInt(req.params.groupId ?? "", "groupId");
      await settlementsService.markPaid(groupId, userId, req.body);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },

  async history(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));
      const groupId = parsePositiveInt(req.params.groupId ?? "", "groupId");
      const history = await settlementsService.history(groupId, userId);
      res.status(200).json({ history });
    } catch (error) {
      next(error);
    }
  },
};
