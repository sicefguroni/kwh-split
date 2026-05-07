import type { NextFunction, Request, Response } from "express";
import { authService } from "./auth.service.js";
import type { LoginInput, SignupInput } from "./auth.schemas.js";
import { clearAuthCookies, setAuthCookies } from "../../utils/cookies.js";
import { getAuthenticatedUserId } from "../../middleware/require-auth.js";
import { env } from "../../config/env.js";
import type { AuthProvider } from "./auth.repository.js";

type TypedBody<T> = Request<unknown, unknown, T>;
const OAUTH_STATE_COOKIE = "split_oauth_state";

const oauthStateCookieOptions = () => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SECURE ? ("none" as const) : ("lax" as const),
  path: "/api/auth",
  maxAge: 10 * 60 * 1_000,
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
});

const beginOauth = async (
  provider: AuthProvider,
  res: Response,
): Promise<void> => {
  const { authorizationUrl, stateToken } = await authService.createProviderStartUrl(provider);
  res.cookie(OAUTH_STATE_COOKIE, stateToken, oauthStateCookieOptions());
  res.redirect(302, authorizationUrl);
};

const finishOauth = async (
  provider: AuthProvider,
  req: Request,
  res: Response,
): Promise<void> => {
  const stateToken =
    typeof req.cookies?.[OAUTH_STATE_COOKIE] === "string" ? req.cookies[OAUTH_STATE_COOKIE] : "";
  res.clearCookie(OAUTH_STATE_COOKIE, oauthStateCookieOptions());

  const providerError = typeof req.query.error === "string" ? req.query.error : undefined;
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";

  if (providerError) {
    res.redirect(authService.buildOAuthResultRedirect({ ok: false, code: providerError }));
    return;
  }
  if (!code || !state || !stateToken) {
    res.redirect(authService.buildOAuthResultRedirect({ ok: false, code: "missing_code_or_state" }));
    return;
  }

  try {
    const result = await authService.completeProviderAuth({
      provider,
      code,
      returnedState: state,
      stateToken,
    });
    setAuthCookies(res, result.tokens);
    res.redirect(authService.buildOAuthResultRedirect({ ok: true }));
  } catch (error) {
    const callbackErrorCode =
      error instanceof Error && "code" in error && typeof error.code === "string"
        ? error.code
        : "oauth_callback_failed";
    res.redirect(authService.buildOAuthResultRedirect({ ok: false, code: callbackErrorCode }));
  }
};

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

  async oauthGoogleStart(_req: Request, res: Response): Promise<void> {
    try {
      await beginOauth("google", res);
    } catch (error) {
      const code =
        error instanceof Error && "code" in error && typeof error.code === "string"
          ? error.code
          : "oauth_start_failed";
      res.redirect(authService.buildOAuthResultRedirect({ ok: false, code }));
    }
  },

  async oauthGoogleCallback(req: Request, res: Response): Promise<void> {
    await finishOauth("google", req, res);
  },
};
