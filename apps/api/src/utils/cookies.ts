import type { CookieOptions, Response } from "express";
import { env } from "../config/env.js";

export const ACCESS_COOKIE = "split_at";
export const REFRESH_COOKIE = "split_rt";

/**
 * The refresh cookie is scoped so browsers only send it to the auth
 * endpoints that consume it, limiting exposure on every other request.
 */
const REFRESH_COOKIE_PATH = "/api/auth";

const baseOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: "lax",
  path: "/",
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
});

export const setAuthCookies = (
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
): void => {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...baseOptions(),
    maxAge: env.JWT_ACCESS_TTL_SECONDS * 1_000,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOptions(),
    maxAge: env.JWT_REFRESH_TTL_SECONDS * 1_000,
    path: REFRESH_COOKIE_PATH,
  });
};

export const clearAuthCookies = (res: Response): void => {
  const opts = baseOptions();
  res.clearCookie(ACCESS_COOKIE, opts);
  res.clearCookie(REFRESH_COOKIE, { ...opts, path: REFRESH_COOKIE_PATH });
};
