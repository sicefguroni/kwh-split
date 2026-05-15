import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validateBody } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { authController } from "./auth.controller.js";
import { LoginSchema, SignupSchema, UpdateProfileSchema } from "./auth.schemas.js";
import { createRedisRateLimitStore } from "../../lib/redis.js";

function rateLimitOpts(prefix: string) {
  const store = createRedisRateLimitStore(prefix);
  return store ? { store } : {};
}

const writeLimiter = rateLimit({
  ...rateLimitOpts("auth-write"),
  windowMs: 15 * 60 * 1_000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: { code: "rate_limited", message: "Too many attempts, try again later." },
  },
});

const refreshLimiter = rateLimit({
  ...rateLimitOpts("auth-refresh"),
  windowMs: 15 * 60 * 1_000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: { code: "rate_limited", message: "Too many refresh attempts, try again later." },
  },
});

export const authRouter: Router = Router();

authRouter.post("/refresh", refreshLimiter, authController.refresh);
authRouter.post("/signup", writeLimiter, validateBody(SignupSchema), authController.signup);
authRouter.post("/login", writeLimiter, validateBody(LoginSchema), authController.login);
authRouter.get("/google/start", authController.oauthGoogleStart);
authRouter.get("/google/callback", authController.oauthGoogleCallback);
authRouter.post("/logout", authController.logout);
authRouter.get("/me", requireAuth, authController.me);
authRouter.patch("/profile", requireAuth, validateBody(UpdateProfileSchema), authController.updateProfile);
