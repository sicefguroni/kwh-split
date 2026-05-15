import { getRedis } from "./redis.js";

const INAPP_QUEUE = "split:inapp:queue";

/** Optional async fan-out path: worker republishes to the realtime Redis channel. */
export async function enqueueInAppFanoutGroup(groupId: number): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    return;
  }
  await redis.rpush(INAPP_QUEUE, JSON.stringify({ type: "fanout_group", groupId }));
}

export async function enqueueInAppFanoutInvitation(userId: number): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    return;
  }
  await redis.rpush(INAPP_QUEUE, JSON.stringify({ type: "fanout_invitation", userId }));
}
