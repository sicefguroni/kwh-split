import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/features/auth/use-auth";
import { useOnlineStatus } from "@/hooks/use-persistent-state";
import { ensureSessionRefreshed } from "@/lib/session-refresh";

interface RealtimeGroupChangeMessage {
  type: "group-changed";
  groupId: string;
}

interface RealtimeInvitationChangeMessage {
  type: "invitation-changed";
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
      void queryClient.invalidateQueries({ queryKey: ["groups"] });
      void queryClient.invalidateQueries({ queryKey: ["groups", groupId] });
      void queryClient.invalidateQueries({ queryKey: ["expenses", groupId] });
      void queryClient.invalidateQueries({ queryKey: ["settlements", groupId] });
      void queryClient.invalidateQueries({ queryKey: ["group-invitations", groupId] });
      void queryClient.invalidateQueries({ queryKey: ["group-invite-link", groupId] });
    };

    const refreshInvitations = () => {
      void queryClient.invalidateQueries({ queryKey: ["incoming-invitations"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["groups"] });
    };

    const connect = async () => {
      if (closed || !isOnline) {
        return;
      }

      await ensureSessionRefreshed();
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
          const message = JSON.parse(event.data as string) as
            | Partial<RealtimeGroupChangeMessage>
            | Partial<RealtimeInvitationChangeMessage>;
          if (message.type === "group-changed" && typeof message.groupId === "string") {
            refreshGroup(message.groupId);
            return;
          }
          if (message.type === "invitation-changed") {
            refreshInvitations();
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
        retryTimer = window.setTimeout(() => {
          void connect();
        }, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30_000);
      };
    };

    void connect();

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
