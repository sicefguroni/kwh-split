import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validateBody } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { authController } from "./auth.controller.js";
import { LoginSchema, SignupSchema } from "./auth.schemas.js";

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: { code: "rate_limited", message: "Too many attempts, try again later." },
  },
});

export const authRouter: Router = Router();

authRouter.post("/signup", writeLimiter, validateBody(SignupSchema), authController.signup);
authRouter.post("/login", writeLimiter, validateBody(LoginSchema), authController.login);
authRouter.post("/logout", authController.logout);
authRouter.get("/me", requireAuth, authController.me);
