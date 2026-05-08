import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";
import { attachRealtimeServer, shutdownRealtimeServer } from "./modules/realtime/realtime-hub.js";

async function start() {
  try {
    await pool.query("SELECT 1");
  } catch (error) {
    console.error("Database connection failed. Check DATABASE_URL or database credentials.", error);
    process.exit(1);
  }

  const app = createApp();
  const server = createServer(app);
  attachRealtimeServer(server);
  server.listen(env.PORT, () => {
    console.log(`[api] listening on http://localhost:${env.PORT}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[api] received ${signal}, shutting down...`);
    shutdownRealtimeServer();
    server.close(() => {
      pool
        .end()
        .catch(() => undefined)
        .finally(() => process.exit(0));
    });
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void start();
