import type { IncomingMessage, Server as HttpServer } from "node:http";
import { Redis } from "ioredis";
import WebSocket, { WebSocketServer } from "ws";
import { pool } from "../../db/pool.js";
import { parseSubjectUserId } from "../common/authorization.js";
import { ACCESS_COOKIE } from "../../utils/cookies.js";
import { unauthorized } from "../../utils/errors.js";
import { verifyAccessToken } from "../../utils/jwt.js";
import { getRedis } from "../../lib/redis.js";

interface RealtimeConnectionState {
  userId: number;
  groupIds: Set<number>;
}

interface GroupChangeMessage {
  type: "group-changed";
  groupId: string;
}

interface InvitationChangeMessage {
  type: "invitation-changed";
}

const REALTIME_PATH = "/api/realtime";
const REALTIME_REDIS_CHANNEL = "split:realtime:events";

let realtimeServer: WebSocketServer | null = null;
let attachedServer: HttpServer | null = null;
let upgradeListener: ((request: IncomingMessage, socket: import("node:net").Socket, head: Buffer) => void) | null =
  null;
let redisSubscriber: Redis | null = null;

const connections = new Map<WebSocket, RealtimeConnectionState>();

const parseCookieHeader = (cookieHeader: string | undefined): Record<string, string> => {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) {
    return cookies;
  }

  for (const part of cookieHeader.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (!name) {
      continue;
    }
    const rawValue = valueParts.join("=");
    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch {
      cookies[name] = rawValue;
    }
  }

  return cookies;
};

async function getAuthenticatedUserId(request: IncomingMessage): Promise<number> {
  const cookies = parseCookieHeader(request.headers.cookie);
  const token = cookies[ACCESS_COOKIE];
  if (typeof token !== "string" || token.length === 0) {
    throw unauthorized();
  }

  const claims = await verifyAccessToken(token);
  return parseSubjectUserId(claims.sub);
}

async function listGroupIdsForUser(userId: number): Promise<Set<number>> {
  const { rows } = await pool.query<{ group_id: number }>(
    `SELECT group_id
     FROM group_members
     WHERE user_id = $1 AND is_active = TRUE`,
    [userId],
  );
  return new Set(rows.map((row) => row.group_id));
}

const serializeGroupChange = (groupId: number): string =>
  JSON.stringify({
    type: "group-changed",
    groupId: String(groupId),
  } satisfies GroupChangeMessage);

const serializeInvitationChange = (): string =>
  JSON.stringify({
    type: "invitation-changed",
  } satisfies InvitationChangeMessage);

function localBroadcastGroupChange(groupId: number): void {
  if (!realtimeServer) {
    return;
  }

  const serialized = serializeGroupChange(groupId);
  for (const [socket, state] of connections) {
    if (socket.readyState !== WebSocket.OPEN) {
      continue;
    }
    if (!state.groupIds.has(groupId)) {
      continue;
    }
    socket.send(serialized);
  }
}

function localBroadcastInvitationChange(userId: number): void {
  if (!realtimeServer) {
    return;
  }

  const serialized = serializeInvitationChange();
  for (const [socket, state] of connections) {
    if (socket.readyState !== WebSocket.OPEN) {
      continue;
    }
    if (state.userId !== userId) {
      continue;
    }
    socket.send(serialized);
  }
}

async function startRealtimeRedisSubscriber(): Promise<void> {
  const primary = getRedis();
  if (!primary) {
    return;
  }

  const sub = primary.duplicate();
  await sub.subscribe(REALTIME_REDIS_CHANNEL);
  redisSubscriber = sub;

  sub.on("message", (_channel: string, message: string) => {
    try {
      const data = JSON.parse(message) as { kind?: string; groupId?: number; userId?: number };
      if (data.kind === "group" && typeof data.groupId === "number") {
        localBroadcastGroupChange(data.groupId);
        return;
      }
      if (data.kind === "invitation" && typeof data.userId === "number") {
        localBroadcastInvitationChange(data.userId);
      }
    } catch {
      // Ignore malformed fan-out payloads.
    }
  });
}

async function handleUpgrade(request: IncomingMessage, socket: import("node:net").Socket, head: Buffer): Promise<void> {
  try {
    if ((request.url ?? "").split("?")[0] !== REALTIME_PATH) {
      socket.destroy();
      return;
    }

    const userId = await getAuthenticatedUserId(request);
    realtimeServer?.handleUpgrade(request, socket, head, (webSocket: WebSocket) => {
      connections.set(webSocket, { userId, groupIds: new Set() });
      realtimeServer?.emit("connection", webSocket, request);
    });
  } catch (error) {
    console.warn("[realtime] WebSocket upgrade rejected", error);
    socket.end("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
  }
}

export function attachRealtimeServer(server: HttpServer): void {
  if (realtimeServer) {
    return;
  }

  realtimeServer = new WebSocketServer({ noServer: true });
  attachedServer = server;

  upgradeListener = (request, socket, head) => {
    void handleUpgrade(request, socket, head);
  };
  server.on("upgrade", upgradeListener);

  void startRealtimeRedisSubscriber().catch((error) => {
    console.error("[realtime] Redis subscriber failed to start", error);
  });

  realtimeServer.on("connection", (socket: WebSocket) => {
    const state = connections.get(socket);
    if (!state) {
      socket.close(1011, "Realtime state missing");
      return;
    }

    void (async () => {
      try {
        const groupIds = await listGroupIdsForUser(state.userId);
        if (!connections.has(socket)) {
          return;
        }
        state.groupIds = groupIds;
      } catch {
        socket.close(1011, "Failed to load realtime subscriptions");
      }
    })();

    socket.on("close", () => {
      connections.delete(socket);
    });
    socket.on("error", () => {
      connections.delete(socket);
    });
  });
}

export function broadcastGroupChange(groupId: number): void {
  const redis = getRedis();
  if (redis) {
    void redis.publish(
      REALTIME_REDIS_CHANNEL,
      JSON.stringify({ kind: "group", groupId }),
    );
  }
  localBroadcastGroupChange(groupId);
}

export function broadcastInvitationChange(userId: number): void {
  const redis = getRedis();
  if (redis) {
    void redis.publish(
      REALTIME_REDIS_CHANNEL,
      JSON.stringify({ kind: "invitation", userId }),
    );
  }
  localBroadcastInvitationChange(userId);
}

export function shutdownRealtimeServer(): void {
  if (redisSubscriber) {
    void redisSubscriber.quit().catch(() => undefined);
    redisSubscriber = null;
  }

  if (attachedServer && upgradeListener) {
    attachedServer.off("upgrade", upgradeListener);
  }
  attachedServer = null;
  upgradeListener = null;

  if (!realtimeServer) {
    return;
  }

  for (const socket of connections.keys()) {
    socket.terminate();
  }
  connections.clear();
  void realtimeServer.close();
  realtimeServer = null;
}
