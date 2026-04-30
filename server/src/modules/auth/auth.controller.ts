import type { NextFunction, Request, Response } from "express";
import { authService } from "./auth.service.js";
import type { LoginInput, SignupInput } from "./auth.schemas.js";
import { clearAuthCookies, setAuthCookies } from "../../utils/cookies.js";
import { getAuthenticatedUserId } from "../../middleware/require-auth.js";

type TypedBody<T> = Request<unknown, unknown, T>;

export const authController = {
  async signup(
    req: TypedBody<SignupInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { user, tokens } = await authService.signup(req.body);
      setAuthCookies(res, tokens);
      res.status(201).json({ user });
    } catch (error) {
      next(error);
    }
  },

  async login(
    req: TypedBody<LoginInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { user, tokens } = await authService.login(req.body);
      setAuthCookies(res, tokens);
      res.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  },

  logout(_req: Request, res: Response): void {
    clearAuthCookies(res);
    res.status(204).end();
  },

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const user = await authService.getCurrentUser(userId);
      res.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  },
};
