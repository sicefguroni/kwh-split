import { pino } from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.NODE_ENV === "development" ? "debug" : "info",
  redact: ["req.headers.cookie", "req.headers.authorization"],
  ...(env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            singleLine: true,
          },
        },
      }
    : {}),
});
