import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../../middleware/require-auth.js";
import { validateBody } from "../../middleware/validate.js";
import { expensesController } from "./expenses.controller.js";
import { receiptController } from "./receipt.controller.js";
import { ExpenseWriteSchema, UpdateExpenseSchema } from "./expenses.schemas.js";
import { ReceiptAssignmentInputSchema } from "./receipt.schemas.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

export const expensesRouter: Router = Router();

expensesRouter.use(requireAuth);
expensesRouter.post("/", validateBody(ExpenseWriteSchema), expensesController.create);
expensesRouter.get("/:groupId", expensesController.listByGroup);
expensesRouter.put("/:id", validateBody(UpdateExpenseSchema), expensesController.update);
expensesRouter.delete("/:id", expensesController.remove);

// Receipt item routes
expensesRouter.get("/:expenseId/receipt-items", receiptController.getItems);
expensesRouter.post(
  "/:expenseId/receipt-items/upload",
  upload.single("receipt"),
  receiptController.uploadReceipt,
);
expensesRouter.put(
  "/:expenseId/receipt-items/assign",
  validateBody(ReceiptAssignmentInputSchema),
  receiptController.assignItems,
);

// OCR preview - extract receipt items without creating an expense
expensesRouter.post("/receipt/preview", upload.single("receipt"), receiptController.extractReceiptPreview);
