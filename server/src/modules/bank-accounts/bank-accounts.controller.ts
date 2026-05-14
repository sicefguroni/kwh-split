import type { NextFunction, Request, Response } from "express";
import { getAuthenticatedUserId } from "../../middleware/require-auth.js";
import { parsePositiveInt, parseSubjectUserId } from "../common/authorization.js";
import { bankAccountsRepository } from "./bank-accounts.repository.js";
import type { CreateBankAccountInput } from "./bank-accounts.schemas.js";

type TypedBody<T> = Request<Record<string, string>, unknown, T>;

export const bankAccountsController = {
  async listOwn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));
      const accounts = await bankAccountsRepository.listByUserId(userId);
      res.status(200).json({
        accounts: accounts.map((a) => ({
          id: String(a.bank_account_id),
          bankName: a.bank_name,
          accountNumber: a.account_number,
        })),
      });
    } catch (error) {
      next(error);
    }
  },

  async listForUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetUserId = parsePositiveInt(req.params.userId ?? "", "userId");
      const accounts = await bankAccountsRepository.listByUserId(targetUserId);
      res.status(200).json({
        accounts: accounts.map((a) => ({
          id: String(a.bank_account_id),
          bankName: a.bank_name,
          accountNumber: a.account_number,
        })),
      });
    } catch (error) {
      next(error);
    }
  },

  async create(req: TypedBody<CreateBankAccountInput>, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));
      const account = await bankAccountsRepository.create(userId, req.body.bankName, req.body.accountNumber);
      res.status(201).json({
        account: {
          id: String(account.bank_account_id),
          bankName: account.bank_name,
          accountNumber: account.account_number,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseSubjectUserId(getAuthenticatedUserId(req));
      const accountId = parsePositiveInt(req.params.accountId ?? "", "accountId");
      await bankAccountsRepository.deleteById(accountId, userId);
      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  },
};
