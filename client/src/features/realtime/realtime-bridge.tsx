import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/features/auth/use-auth";
import { useOnlineStatus } from "@/hooks/use-persistent-state";

interface RealtimeGroupChangeMessage {
  type: "group-changed";
  groupId: string;
}

const buildRealtimeUrl = (): string => {
  const url = new URL("/api/realtime", window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
};

export function RealtimeUpdatesBridge() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (!user || !isOnline) {
      return;
    }

    let closed = false;
    let retryDelay = 1000;
    let retryTimer: number | null = null;
    let socket: WebSocket | null = null;

    const refreshGroup = (groupId: string) => {
      void queryClient.invalidateQueries({ queryKey: ["expenses", groupId] });
      void queryClient.invalidateQueries({ queryKey: ["settlements", groupId] });
    };

    const connect = () => {
      if (closed || !isOnline) {
        return;
      }

      const nextSocket = new WebSocket(buildRealtimeUrl());
      socket = nextSocket;

      nextSocket.onopen = () => {
        retryDelay = 1000;
      };

      nextSocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string) as Partial<RealtimeGroupChangeMessage>;
          if (message.type === "group-changed" && typeof message.groupId === "string") {
            refreshGroup(message.groupId);
          }
        } catch {
          // Ignore malformed push messages.
        }
      };

      nextSocket.onerror = () => {
        nextSocket.close();
      };

      nextSocket.onclose = () => {
        if (closed || !isOnline) {
          return;
        }
        retryTimer = window.setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30_000);
      };
    };

    connect();

    return () => {
      closed = true;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
      socket?.close(1000, "cleanup");
    };
  }, [isOnline, queryClient, user]);

  return null;
}