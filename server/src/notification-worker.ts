/**
 * ECS notification worker: consumes optional in-app jobs from Redis and
 * republishes to the realtime fan-out channel. API tasks handle WebSockets.
 */
import { pool } from "./db/pool.js";
import { getRedis, initRedis, shutdownRedis } from "./lib/redis.js";

const INAPP_QUEUE = "split:inapp:queue";
const REALTIME_CHANNEL = "split:realtime:events";

async function run(): Promise<void> {
  await pool.query("SELECT 1");
  await initRedis();
  const redis = getRedis();
  if (!redis) {
    console.error("[notification-worker] REDIS_URL is required for this process");
    process.exit(1);
  }

  console.log(`[notification-worker] draining ${INAPP_QUEUE} (BRPOP timeout 30s)`);

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[notification-worker] ${signal}, shutting down...`);
    await shutdownRedis().catch(() => undefined);
    await pool.end().catch(() => undefined);
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  while (true) {
    let result: [string, string] | null;
    try {
      result = await redis.brpop(INAPP_QUEUE, 30);
    } catch {
      break;
    }
    if (!result) {
      continue;
    }
    const [, element] = result;
    try {
      const job = JSON.parse(element) as { type?: string; groupId?: number; userId?: number };
      if (job.type === "fanout_group" && typeof job.groupId === "number") {
        await redis.publish(REALTIME_CHANNEL, JSON.stringify({ kind: "group", groupId: job.groupId }));
      }
      if (job.type === "fanout_invitation" && typeof job.userId === "number") {
        await redis.publish(REALTIME_CHANNEL, JSON.stringify({ kind: "invitation", userId: job.userId }));
      }
    } catch {
      // Ignore malformed payloads.
    }
  }

  await shutdownRedis().catch(() => undefined);
  await pool.end().catch(() => undefined);
}

void run().catch((error) => {
  console.error("[notification-worker] fatal error", error);
  process.exit(1);
});
