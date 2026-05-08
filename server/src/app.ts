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
import { requireAuth } from "./middleware/require-auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";

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
      origin: env.WEB_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "3mb" }));
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/sync", requireAuth, offlineSyncRouter);
  app.get("/api/expenses", requireAuth, listSyncedExpenses);

  app.use("/api/auth", authRouter);
  app.use("/api/groups", groupsRouter);
  app.use("/api/expenses", expensesRouter);
  app.use("/api/settlements", settlementsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
