import { env } from "../config/env.js";
import { getRedis } from "./redis.js";

const sessionKey = (userId: string): string => `split:session:${userId}`;

export async function markUserSessionActive(userId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    return;
  }
  await redis.setex(sessionKey(userId), env.JWT_REFRESH_TTL_SECONDS, "1");
}

export async function clearUserSessionActive(userId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    return;
  }
  await redis.del(sessionKey(userId));
}

export async function isUserSessionActive(userId: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) {
    return true;
  }
  const value = await redis.get(sessionKey(userId));
  return value === "1";
}
