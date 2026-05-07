import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { validateBody } from "../../middleware/validate.js";
import { expensesController } from "./expenses.controller.js";
import { ExpenseWriteSchema, UpdateExpenseSchema } from "./expenses.schemas.js";

export const expensesRouter: Router = Router();

expensesRouter.use(requireAuth);
expensesRouter.post("/", validateBody(ExpenseWriteSchema), expensesController.create);
expensesRouter.get("/:groupId", expensesController.listByGroup);
expensesRouter.put("/:id", validateBody(UpdateExpenseSchema), expensesController.update);
expensesRouter.delete("/:id", expensesController.remove);
