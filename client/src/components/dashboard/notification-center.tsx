import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  useAcceptIncomingInvitationMutation,
  useDeclineIncomingInvitationMutation,
  useIncomingInvitationsQuery,
  useMarkNotificationsReadMutation,
  useNotificationsQuery,
} from "@/features/groups/use-groups";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

function formatRelativeDate(value: string): string {
  return new Date(value).toLocaleString();
}

export function NotificationCenter() {
  const navigate = useNavigate();
  const { data: invitations = [] } = useIncomingInvitationsQuery();
  const { data: notifications = [] } = useNotificationsQuery();
  const acceptMutation = useAcceptIncomingInvitationMutation();
  const declineMutation = useDeclineIncomingInvitationMutation();
  const markReadMutation = useMarkNotificationsReadMutation();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState("");

  const pendingInvitations = useMemo(
    () => invitations.filter((invitation) => invitation.status === "pending"),
    [invitations],
  );

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.isRead),
    [notifications],
  );

  const badgeCount = pendingInvitations.length + unreadNotifications.length;

  useEffect(() => {
    if (!isOpen || unreadNotifications.length === 0 || markReadMutation.isPending) {
      return;
    }

    void markReadMutation.mutateAsync().catch(() => undefined);
  }, [isOpen, markReadMutation, unreadNotifications.length]);

  const handleAccept = async (invitationId: string) => {
    try {
      setError("");
      const group = await acceptMutation.mutateAsync({ invitationId });
      setIsOpen(false);
      navigate(`/group/${group.id}`);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to accept the invite.");
    }
  };

  const handleDecline = async (invitationId: string) => {
    try {
      setError("");
      await declineMutation.mutateAsync({ invitationId });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to decline the invite.");
    }
  };

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Notifications"
        onClick={() => setIsOpen((current) => !current)}
        className="relative"
      >
        <Bell className="h-4 w-4" />
        {badgeCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {badgeCount}
          </span>
        ) : null}
        <span className="hidden sm:inline">Notifications</span>
      </Button>

      {isOpen ? (
        <div className="absolute right-0 top-12 z-40 w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
              <p className="mt-1 text-xs text-slate-500">
                Live invites plus accept and decline activity from collaborators.
              </p>
            </div>
            <button
              type="button"
              className="rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              onClick={() => setIsOpen(false)}
            >
              Close
            </button>
          </div>

          <div className="max-h-[min(32rem,calc(100vh-7rem))] overflow-y-auto px-4 py-4">
            {error ? (
              <p className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            ) : null}

            <div className="space-y-6">
              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Pending invites
                    </h4>
                    <p className="mt-1 text-xs text-slate-400">
                      Invite links sent directly to you.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                    {pendingInvitations.length}
                  </span>
                </div>

                {pendingInvitations.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                    No pending invites.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingInvitations.map((invitation) => (
                      <div
                        key={invitation.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">
                              {invitation.inviterName} invited you to {invitation.groupName}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Expires {formatRelativeDate(invitation.expiresAt)}
                            </p>
                          </div>
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                            pending
                          </span>
                        </div>

                        <div className="mt-3 flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              void handleAccept(invitation.id);
                            }}
                            disabled={acceptMutation.isPending || declineMutation.isPending}
                          >
                            Accept
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              void handleDecline(invitation.id);
                            }}
                            disabled={acceptMutation.isPending || declineMutation.isPending}
                          >
                            Decline
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Invite activity
                    </h4>
                    <p className="mt-1 text-xs text-slate-400">
                      Realtime updates when someone accepts or declines.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                    {notifications.length}
                  </span>
                </div>

                {notifications.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                    No invite activity yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:bg-slate-50"
                        onClick={() => {
                          if (notification.groupId) {
                            navigate(`/group/${notification.groupId}`);
                            setIsOpen(false);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                            <p className="mt-1 text-xs text-slate-500">{notification.message}</p>
                          </div>
                          {!notification.isRead ? (
                            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500" aria-hidden />
                          ) : null}
                        </div>
                        <p className="mt-3 text-[11px] text-slate-400">
                          {formatRelativeDate(notification.createdAt)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
