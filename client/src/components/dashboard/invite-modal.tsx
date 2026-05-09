import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { groupsApi } from "@/features/groups/api";
import { InviteRecipientPicker, type InviteRecipientDraft } from "@/components/dashboard/invite-recipient-picker";
import { ApiError } from "@/lib/api-client";

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
}

export function InviteModal({ isOpen, onClose, groupId, groupName }: InviteModalProps) {
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<InviteRecipientDraft[]>([]);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const queryClient = useQueryClient();

  const { data: inviteLinkData, isLoading: linkLoading } = useQuery({
    queryKey: ["group-invite-link", groupId],
    queryFn: () => groupsApi.getInviteLink(groupId),
    enabled: isOpen,
  });

  const { data: invitationsData, isLoading: invitationsLoading } = useQuery({
    queryKey: ["group-invitations", groupId],
    queryFn: () => groupsApi.listInvitations(groupId),
    enabled: isOpen,
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      groupsApi.createInvitations(groupId, {
        recipients: recipients.map((recipient) =>
          recipient.userId
            ? { userId: Number(recipient.userId) }
            : { email: recipient.email },
        ),
      }),
    onSuccess: async (result) => {
      setRecipients([]);
      await queryClient.invalidateQueries({ queryKey: ["group-invitations", groupId] });
      await queryClient.invalidateQueries({ queryKey: ["incoming-invitations"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });

      const createdCount = result.created.length;
      const skippedCount = result.skipped.length;
      const skippedDelivery = result.created.filter((invitation) => invitation.deliveryStatus === "skipped").length;
      const failedDelivery = result.created.filter((invitation) => invitation.deliveryStatus === "failed").length;
      const emailSummary =
        failedDelivery > 0
          ? ` ${failedDelivery} email${failedDelivery === 1 ? "" : "s"} failed to send.`
          : skippedDelivery > 0
            ? ` SMTP is not configured, so ${skippedDelivery} email${skippedDelivery === 1 ? "" : "s"} were created without sending mail.`
            : "";
      if (createdCount > 0 && skippedCount === 0) {
        setFeedback({
          kind: "success",
          text: `${createdCount === 1 ? "Invitation sent." : `${createdCount} invitations sent.`}${emailSummary}`,
        });
        return;
      }

      if (createdCount > 0) {
        setFeedback({
          kind: "success",
          text: `${createdCount} invite${createdCount === 1 ? "" : "s"} sent. ${skippedCount} skipped.${emailSummary}`,
        });
        return;
      }

      setFeedback({
        kind: "error",
        text: result.skipped[0]?.reason ?? "No invitations were created.",
      });
    },
    onError: (cause) => {
      setFeedback({
        kind: "error",
        text: cause instanceof ApiError ? cause.message : "Failed to send invitations.",
      });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () => groupsApi.regenerateInviteLink(groupId),
    onSuccess: async (response) => {
      setInviteLink(response.inviteToken ? `${window.location.origin}/join/${response.inviteToken}` : null);
      await queryClient.invalidateQueries({ queryKey: ["group-invite-link", groupId] });
    },
    onError: (cause) => {
      setFeedback({
        kind: "error",
        text: cause instanceof ApiError ? cause.message : "Failed to regenerate the invite link.",
      });
    },
  });

  const handleInviteSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (recipients.length === 0) {
      setFeedback({ kind: "error", text: "Add at least one recipient." });
      return;
    }

    setFeedback(null);
    await inviteMutation.mutateAsync();
  };

  const currentInviteLink = useMemo(() => {
    if (inviteLink) {
      return inviteLink;
    }
    if (!inviteLinkData?.inviteToken) {
      return null;
    }
    return `${window.location.origin}/join/${inviteLinkData.inviteToken}`;
  }, [inviteLink, inviteLinkData?.inviteToken]);

  const copyInviteLink = async () => {
    if (!currentInviteLink) {
      return;
    }

    await navigator.clipboard.writeText(currentInviteLink);
    setFeedback({ kind: "success", text: "Invite link copied." });
  };

  if (!isOpen) return null;

  const invitations = invitationsData?.invitations ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="flex w-full max-w-2xl flex-col h-full max-h-[90vh] overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Invite to {groupName}</h2>
              <p className="text-sm text-gray-600">Send bulk invites, search collaborators, or share a link.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 overflow-y-auto pb-6">
          {feedback ? (
            <div
              className={
                feedback.kind === "success"
                  ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                  : "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              }
            >
              {feedback.text}
            </div>
          ) : null}

          <form onSubmit={(event) => void handleInviteSubmit(event)} className="space-y-4">
            <InviteRecipientPicker
              recipients={recipients}
              onChange={setRecipients}
              excludeGroupId={groupId}
              disabled={inviteMutation.isPending}
              title="Send invitations"
              description="Paste multiple emails at once, or search people you have collaborated with before."
            />
            <Button type="submit" disabled={inviteMutation.isPending || recipients.length === 0}>
              {inviteMutation.isPending ? <Spinner /> : "Send invitations"}
            </Button>
          </form>

          <div className="space-y-3 rounded-3xl bg-slate-50 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Public invite link</p>
              <p className="mt-1 text-xs text-slate-500">
                Share a reusable link for anyone who should be able to join this group.
              </p>
            </div>

            {linkLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Spinner />
                Loading invite link...
              </div>
            ) : currentInviteLink ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2">
                  <input
                    type="text"
                    value={currentInviteLink}
                    readOnly
                    aria-label="Invite link"
                    title="Invite link"
                    className="flex-1 bg-transparent px-2 text-sm text-slate-700 outline-none"
                  />
                  <Button variant="ghost" size="sm" onClick={() => void copyInviteLink()}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setFeedback(null);
                    void regenerateMutation.mutateAsync();
                  }}
                  disabled={regenerateMutation.isPending}
                >
                  {regenerateMutation.isPending ? <Spinner /> : <RefreshCw className="h-4 w-4" />}
                  Regenerate link
                </Button>
              </div>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setFeedback(null);
                  void regenerateMutation.mutateAsync();
                }}
                disabled={regenerateMutation.isPending}
              >
                {regenerateMutation.isPending ? <Spinner /> : "Generate invite link"}
              </Button>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Invitation activity</p>
              <p className="mt-1 text-xs text-slate-500">Pending and accepted invitations for this group.</p>
            </div>

            {invitationsLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Spinner />
                Loading invitations...
              </div>
            ) : invitations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                No invitations yet.
              </div>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {invitation.inviteeName ?? invitation.inviteeEmail}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {invitation.inviteeEmail} • invited by {invitation.inviterName}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={
                          invitation.status === "pending"
                            ? "rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800"
                            : invitation.status === "accepted"
                              ? "rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800"
                              : invitation.status === "declined"
                                ? "rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700"
                                : "rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-700"
                        }
                      >
                        {invitation.status}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {new Date(invitation.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
