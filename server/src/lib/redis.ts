import { Redis } from "ioredis";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import { env } from "../config/env.js";

let shared: Redis | null = null;

export async function initRedis(): Promise<void> {
  if (!env.REDIS_URL) {
    return;
  }
  shared = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  await shared.ping();
}

export function getRedis(): Redis | null {
  return shared;
}

/** One store per rate limiter (express-rate-limit ERR_ERL_STORE_REUSE). */
export function createRedisRateLimitStore(prefix: string): RedisStore | undefined {
  const client = getRedis();
  if (!client) {
    return undefined;
  }
  return new RedisStore({
    prefix: `rl:${prefix}:`,
    sendCommand: (command: string, ...args: string[]) =>
      client.call(command, ...args) as Promise<RedisReply>,
  });
}

export async function shutdownRedis(): Promise<void> {
  if (shared) {
    await shared.quit();
    shared = null;
  }
}
