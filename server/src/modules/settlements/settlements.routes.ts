import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { validateBody } from "../../middleware/validate.js";
import { settlementsController } from "./settlements.controller.js";
import { MarkPaidSchema } from "./settlements.schemas.js";

export const settlementsRouter: Router = Router();

settlementsRouter.use(requireAuth);
settlementsRouter.get("/:groupId", settlementsController.dashboard);
settlementsRouter.post(
  "/:groupId/mark-paid",
  validateBody(MarkPaidSchema),
  settlementsController.markPaid,
);
settlementsRouter.get("/:groupId/history", settlementsController.history);
