import type { IncomingMessage, Server as HttpServer } from "node:http";
import WebSocket, { WebSocketServer } from "ws";
import { pool } from "../../db/pool.js";
import { parseSubjectUserId } from "../common/authorization.js";
import { ACCESS_COOKIE } from "../../utils/cookies.js";
import { unauthorized } from "../../utils/errors.js";
import { verifyAccessToken } from "../../utils/jwt.js";

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

let realtimeServer: WebSocketServer | null = null;
let attachedServer: HttpServer | null = null;
let upgradeListener: ((request: IncomingMessage, socket: import("node:net").Socket, head: Buffer) => void) | null = null;

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
     WHERE user_id = $1`,
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
  } catch {
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

export function broadcastInvitationChange(userId: number): void {
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

export function shutdownRealtimeServer(): void {
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
