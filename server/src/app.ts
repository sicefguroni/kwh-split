import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import {
  listSyncedExpenses,
  offlineSyncRouter,
} from "./modules/offline-sync/offline-sync.routes.js";
import { groupsRouter } from "./modules/groups/groups.routes.js";
import { expensesRouter } from "./modules/expenses/expenses.routes.js";
import { settlementsRouter } from "./modules/settlements/settlements.routes.js";
import { bankAccountsRouter } from "./modules/bank-accounts/bank-accounts.routes.js";
import { requireAuth } from "./middleware/require-auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import rateLimit from "express-rate-limit";
import { createRedisRateLimitStore } from "./lib/redis.js";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(
    pinoHttp({
      redact: ["req.headers.cookie", "req.headers.authorization"],
      ...(env.NODE_ENV === "development"
        ? { transport: { target: "pino-pretty", options: { singleLine: true } } }
        : {}),
    }),
  );

  app.use(helmet());
  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        if (!requestOrigin) return callback(null, true);
        if (env.NODE_ENV === "development") return callback(null, true);

        // In production, allow the exact WEB_ORIGIN and the CloudFront domain
        const allowedOrigins = [env.WEB_ORIGIN];
        if (requestOrigin.endsWith(".cloudfront.net")) {
          allowedOrigins.push(requestOrigin);
        }

        if (allowedOrigins.includes(requestOrigin)) {
          return callback(null, true);
        }

        console.error(`CORS rejected origin: ${requestOrigin}. Allowed: ${env.WEB_ORIGIN}`);
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "3mb" }));
  app.use(cookieParser());

  const store = createRedisRateLimitStore("global");
  const globalLimiter = rateLimit({
    ...(store ? { store } : {}),
    windowMs: 5 * 60 * 1_000,
    limit: 600,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error: { code: "rate_limited", message: "Too many requests, please try again later." },
    },
  });

  app.use("/api", globalLimiter);

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/sync", requireAuth, offlineSyncRouter);
  app.get("/api/expenses", requireAuth, listSyncedExpenses);

  app.use("/api/auth", authRouter);
  app.use("/api/groups", groupsRouter);
  app.use("/api/expenses", expensesRouter);
  app.use("/api/settlements", settlementsRouter);
  app.use("/api/bank-accounts", bankAccountsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
