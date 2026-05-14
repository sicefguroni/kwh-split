import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { validateBody } from "../../middleware/validate.js";
import { bankAccountsController } from "./bank-accounts.controller.js";
import { CreateBankAccountSchema } from "./bank-accounts.schemas.js";

export const bankAccountsRouter: Router = Router();
bankAccountsRouter.use(requireAuth);

// "me" routes must be defined before "/:userId" to avoid matching "me" as a userId
bankAccountsRouter.get("/me", bankAccountsController.listOwn);
bankAccountsRouter.post("/me", validateBody(CreateBankAccountSchema), bankAccountsController.create);
bankAccountsRouter.delete("/me/:accountId", bankAccountsController.remove);
bankAccountsRouter.get("/user/:userId", bankAccountsController.listForUser);
