import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useAcceptIncomingInvitationMutation,
  useClearNotificationsMutation,
  useDeclineIncomingInvitationMutation,
  useIncomingInvitationsQuery,
  useMarkNotificationsReadMutation,
  useNotificationsQuery,
} from "@/features/groups/use-groups";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

function formatRelativeDate(value: string): string {
  return new Date(value).toLocaleString();
}

export function NotificationCenter({ variant = "light" }: { variant?: "light" | "dark" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  const { data: invitations = [] } = useIncomingInvitationsQuery();
  const { data: notifications = [] } = useNotificationsQuery();
  const acceptMutation = useAcceptIncomingInvitationMutation();
  const declineMutation = useDeclineIncomingInvitationMutation();
  const markReadMutation = useMarkNotificationsReadMutation();
  const clearMutation = useClearNotificationsMutation();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const [error, setError] = useState("");
  const [deletedInvitationIds, setDeletedInvitationIds] = useState<string[]>([]);
  const [deletedNotificationIds, setDeletedNotificationIds] = useState<string[]>([]);

  const visibleInvitations = useMemo(
    () => invitations.filter((invitation) => !deletedInvitationIds.includes(invitation.id)),
    [invitations, deletedInvitationIds],
  );

  const visibleNotifications = useMemo(
    () => notifications.filter((notification) => !deletedNotificationIds.includes(notification.id)),
    [notifications, deletedNotificationIds],
  );

  const pendingInvitations = useMemo(
    () => visibleInvitations.filter((invitation) => invitation.status === "pending"),
    [visibleInvitations],
  );

  const unreadNotifications = useMemo(
    () => visibleNotifications.filter((notification) => !notification.isRead),
    [visibleNotifications],
  );

  const badgeCount = pendingInvitations.length + unreadNotifications.length;

  useEffect(() => {
    if (!isOpen || unreadNotifications.length === 0 || markReadMutation.isPending) {
      return;
    }

    void markReadMutation.mutateAsync().catch(() => undefined);
  }, [isOpen, markReadMutation, unreadNotifications.length]);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !wrapperRef.current || window.innerWidth < 640) {
      setPanelStyle({});
      return;
    }
    const rect = wrapperRef.current.getBoundingClientRect();
    setPanelStyle({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (wrapperRef.current?.contains(target)) return;

      const portal = document.querySelector("[data-notification-panel]");
      if (portal?.contains(target)) return;

      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("touchstart", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleAccept = async (invitationId: string) => {
    try {
      setError("");
      const group = await acceptMutation.mutateAsync({ invitationId });
      // Don't close the panel immediately to show the updated status
      navigate(`/group/${group.id}`);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to accept the invite.");
    }
  };

  const handleDecline = async (invitationId: string) => {
    try {
      setError("");
      await declineMutation.mutateAsync({ invitationId });
      // Don't close the panel to show the updated status
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to decline the invite.");
    }
  };

  const handleDeleteNotification = (notificationId: string, type: "invitation" | "activity") => {
    if (type === "invitation") {
      setDeletedInvitationIds((current) => [...current, notificationId]);
    } else {
      setDeletedNotificationIds((current) => [...current, notificationId]);
    }

    addToast("Notification deleted", "success");
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setIsOpen((current) => !current)}
        className={
          variant === "dark"
            ? "relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-white/20"
            : "relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-ink-900 transition hover:bg-white/60"
        }
      >
        <Bell className="h-4 w-4" />
        {badgeCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {badgeCount}
          </span>
        ) : null}
      </button>

      {isOpen ? createPortal(
        <div
          data-notification-panel
          className="fixed inset-0 z-[9999] bg-white sm:inset-auto sm:w-[min(26rem,calc(100vw-2rem))] sm:overflow-hidden sm:rounded-3xl sm:border sm:border-slate-200 sm:shadow-xl"
          style={panelStyle}
        >
          <div className="flex h-full flex-col sm:h-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Live invites and activity from your collaborators.
                </p>
              </div>
              <button
                type="button"
                className="cursor-pointer rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                onClick={() => setIsOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:flex-none sm:max-h-[min(32rem,calc(100vh-7rem))]">
              {error ? (
                <p className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </p>
              ) : null}

              <div className="space-y-6 pb-6 sm:pb-0">
                <section>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Invitations
                      </h4>
                      <p className="mt-1 text-xs text-slate-400">
                        All invitation activity and status updates.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {visibleInvitations.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeletedInvitationIds((prev) => [
                              ...prev,
                              ...visibleInvitations.map((inv) => inv.id),
                            ]);
                            addToast("Invitations cleared", "success");
                          }}
                        >
                          Clear all
                        </Button>
                      )}
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                        {visibleInvitations.length}
                      </span>
                    </div>
                  </div>

                  {visibleInvitations.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                      No invitations yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {visibleInvitations.map((invitation) => (
                        <div
                          key={invitation.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-900">
                                {invitation.inviterName} invited you to {invitation.groupName}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {invitation.status === "pending"
                                  ? `Expires ${formatRelativeDate(invitation.expiresAt)}`
                                  : `Updated ${formatRelativeDate(invitation.createdAt)}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${invitation.status === "pending"
                                  ? "bg-amber-100 text-amber-800"
                                  : invitation.status === "accepted"
                                    ? "bg-green-100 text-green-800"
                                    : invitation.status === "declined"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-gray-100 text-gray-800"
                                  }`}
                              >
                                {invitation.status}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteNotification(invitation.id, "invitation")}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                                title="Delete notification"
                                aria-label="Delete invitation notification"
                              >
                                ×
                              </button>
                            </div>
                          </div>

                          {invitation.status === "pending" && (
                            <div className="mt-3 flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => void handleAccept(invitation.id)}
                                disabled={acceptMutation.isPending || declineMutation.isPending}
                              >
                                Accept
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => void handleDecline(invitation.id)}
                                disabled={acceptMutation.isPending || declineMutation.isPending}
                              >
                                Decline
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Activity
                      </h4>
                      <p className="mt-1 text-xs text-slate-400">
                        Realtime updates on group activity — members, expenses, and settlements.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {visibleNotifications.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={clearMutation.isPending}
                          onClick={() => {
                            clearMutation.mutate({ category: "activity" });
                            setDeletedNotificationIds([]);
                          }}
                        >
                          Clear all
                        </Button>
                      )}
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                        {visibleNotifications.length}
                      </span>
                    </div>
                  </div>

                  {visibleNotifications.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                      No activity yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {visibleNotifications.map((notification) => (
                        <div
                          key={notification.id}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <button
                              type="button"
                              className="block w-full text-left"
                              onClick={() => {
                                if (notification.groupId) {
                                  navigate(`/group/${notification.groupId}`);
                                  setIsOpen(false);
                                }
                              }}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                                <p className="mt-1 text-xs text-slate-500">{notification.message}</p>
                              </div>
                            </button>
                            <div className="flex items-center gap-2">
                              {!notification.isRead ? (
                                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500" aria-hidden />
                              ) : null}
                              <button
                                type="button"
                                onClick={() => handleDeleteNotification(notification.id, "activity")}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                                title="Delete notification"
                                aria-label="Delete activity notification"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                          <p className="mt-3 text-[11px] text-slate-400">
                            {formatRelativeDate(notification.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}
