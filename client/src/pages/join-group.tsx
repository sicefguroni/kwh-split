import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Users } from "lucide-react";
import { groupsApi } from "@/features/groups/api";
import { useCurrentUser } from "@/features/auth/use-auth";
import type { ApiInvitePreview } from "@/features/groups/types";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";

function buildAuthTarget(path: "/login" | "/signup", token: string, email?: string | null): string {
  const params = new URLSearchParams({ redirect: `/join/${token}` });
  if (email) {
    params.set("email", email);
  }
  return `${path}?${params.toString()}`;
}

export default function JoinGroupPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { data: user, isLoading: isAuthLoading } = useCurrentUser();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<ApiInvitePreview | null>(null);
  const [autoAcceptAttempted, setAutoAcceptAttempted] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid invite link");
      setLoading(false);
      return;
    }

    const loadInvite = async () => {
      try {
        const response = await groupsApi.previewInviteToken(token);
        setInvite(response.invite);
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : "Failed to load invite");
      } finally {
        setLoading(false);
      }
    };

    void loadInvite();
  }, [token]);

  const authTargets = useMemo(() => {
    if (!token) {
      return { login: "/login", signup: "/signup" };
    }
    return {
      login: buildAuthTarget("/login", token, invite?.inviteeEmail),
      signup: buildAuthTarget("/signup", token, invite?.inviteeEmail),
    };
  }, [invite?.inviteeEmail, token]);

  useEffect(() => {
    if (isAuthLoading || !token || !user || !invite || autoAcceptAttempted) {
      return;
    }

    const isAcceptable = invite.status === "pending" || invite.status === "available";
    if (!isAcceptable) {
      return;
    }

    setAutoAcceptAttempted(true);

    const acceptInvitation = async () => {
      try {
        setSubmitting(true);
        setError(null);
        const response = await groupsApi.acceptInviteToken(token);
        addToast(`Successfully joined ${response.group.name}!`, "success");
        navigate(`/group/${response.group.id}`, { replace: true });
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 401) {
          navigate(authTargets.login);
          return;
        }
        setError(cause instanceof ApiError ? cause.message : "Failed to accept invitation");
      } finally {
        setSubmitting(false);
      }
    };

    void acceptInvitation();
  }, [addToast, autoAcceptAttempted, authTargets.login, invite, isAuthLoading, navigate, token, user]);

  const handleAcceptInvitation = async () => {
    if (!token) return;
    if (!user) {
      navigate(authTargets.login);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const response = await groupsApi.acceptInviteToken(token);
      addToast(`Successfully joined ${response.group.name}!`, "success");
      navigate(`/group/${response.group.id}`, { replace: true });
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        navigate(authTargets.login);
        return;
      }
      setError(cause instanceof ApiError ? cause.message : "Failed to accept invitation");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || isAuthLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-slate-50 to-cyan-50">
        <Spinner />
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-slate-50 to-cyan-50 p-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <span className="text-2xl">✕</span>
          </div>
          <h2 className="mt-5 text-xl font-bold text-slate-900">Unable to open invite</h2>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
          <Button onClick={() => navigate("/")} className="mt-6 w-full">
            Go home
          </Button>
        </div>
      </div>
    );
  }

  if (!invite) {
    return null;
  }

  const isPending = invite.status === "pending" || invite.status === "available";
  const isLoggedIn = !!user;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-slate-50 to-cyan-50 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl">
        {/* Cover / Header */}
        {invite.group.imageUrl ? (
          <div className="relative h-36 overflow-hidden">
            <img
              src={invite.group.imageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          </div>
        ) : (
          <div className="flex h-36 items-center justify-center bg-gradient-to-br from-slate-800 via-cyan-900 to-cyan-600">
            <span className="text-5xl font-bold text-white/30">
              {invite.group.name
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase())
                .join("")}
            </span>
          </div>
        )}

        <div className="px-6 pb-6 pt-5">
          {/* Group info */}
          <h1 className="text-xl font-bold text-slate-900">{invite.group.name}</h1>

          {invite.group.description && (
            <p className="mt-1 text-sm text-slate-500">{invite.group.description}</p>
          )}

          <div className="mt-3 flex items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {invite.group.memberCount} {invite.group.memberCount === 1 ? "member" : "members"}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {invite.group.currency}
            </span>
          </div>

          {/* Invite context */}
          {invite.kind === "direct" && invite.inviterName && (
            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <span className="font-medium text-slate-900">{invite.inviterName}</span> invited{" "}
              {invite.inviteeEmail ? (
                <span className="font-medium text-slate-900">{invite.inviteeEmail}</span>
              ) : (
                "you"
              )}{" "}
              to join this group.
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Status badge for non-pending invites */}
          {!isPending && (
            <div className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm text-slate-600">
              This invitation is <strong>{invite.status}</strong>.
            </div>
          )}

          {/* Not logged in notice (only for direct invites) */}
          {!isLoggedIn && invite.kind === "direct" && (
            <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
              Sign in or create an account to accept this invite.
              {invite.inviteeEmail ? ` Use ${invite.inviteeEmail} if possible.` : ""}
            </div>
          )}

          {/* Actions */}
          <div className="mt-5 space-y-2.5">
            <Button
              onClick={() => void handleAcceptInvitation()}
              className="w-full"
              disabled={submitting || !isPending}
            >
              {submitting ? (
                <Spinner />
              ) : !isLoggedIn ? (
                "Sign in to join"
              ) : invite.kind === "public" ? (
                "Join group"
              ) : (
                "Accept invitation"
              )}
            </Button>

            {!isLoggedIn && (
              <Button
                variant="secondary"
                onClick={() => navigate(authTargets.signup)}
                className="w-full"
                disabled={submitting || !isPending}
              >
                Create an account
              </Button>
            )}

            <button
              type="button"
              onClick={() => navigate("/")}
              className="w-full py-2 text-center text-sm text-slate-400 transition hover:text-slate-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
