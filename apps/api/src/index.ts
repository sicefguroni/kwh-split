import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`[api] listening on http://localhost:${env.PORT}`);
});

const shutdown = async (signal: string): Promise<void> => {
  console.log(`[api] received ${signal}, shutting down...`);
  server.close(() => {
    pool
      .end()
      .catch(() => undefined)
      .finally(() => process.exit(0));
  });
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
