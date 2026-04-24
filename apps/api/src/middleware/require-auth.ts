import type { NextFunction, Request, Response } from "express";
import { ACCESS_COOKIE } from "../utils/cookies.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { unauthorized } from "../utils/errors.js";

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = req.cookies?.[ACCESS_COOKIE];
    if (typeof token !== "string" || token.length === 0) {
      throw unauthorized();
    }
    const claims = await verifyAccessToken(token);
    req.userId = claims.sub;
    next();
  } catch {
    next(unauthorized());
  }
}

/**
 * Resolves the authenticated user id from a request that has already passed
 * through `requireAuth`. Throws if the middleware was skipped by mistake so
 * handlers never silently operate with an unknown identity.
 */
export function getAuthenticatedUserId(req: Request): string {
  const userId = req.userId;
  if (!userId) {
    throw unauthorized();
  }
  return userId;
}
