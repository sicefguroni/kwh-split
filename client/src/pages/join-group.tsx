import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { groupsApi } from "@/features/groups/api";
import { useCurrentUser } from "@/features/auth/use-auth";
import type { ApiInvitePreview } from "@/features/groups/types";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

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
  const { data: user } = useCurrentUser();
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
    if (!token || !user || !invite || autoAcceptAttempted) {
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
        navigate(`/group/${response.group.id}`);
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
  }, [autoAcceptAttempted, authTargets.login, invite, navigate, token, user]);

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
      navigate(`/group/${response.group.id}`);
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <h2 className="text-lg font-semibold text-red-600">Unable to open invite</h2>
            <p className="mt-2 text-sm text-gray-600">{error}</p>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")} className="w-full">
              Go home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invite) {
    return null;
  }

  const isPending = invite.status === "pending" || invite.status === "available";
  const buttonLabel = !user ? "Sign in to continue" : invite.kind === "public" ? "Join group" : "Accept invitation";

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h2 className="text-lg font-semibold">
            {invite.kind === "public" ? "Join Group" : "Invitation"}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {invite.kind === "public"
              ? `You can join ${invite.group.name} with this shared invite link.`
              : `${invite.inviterName} invited ${invite.inviteeEmail} to join ${invite.group.name}.`}
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p><strong>Name:</strong> {invite.group.name}</p>
            <p><strong>Members:</strong> {invite.group.memberCount}</p>
            <p><strong>Currency:</strong> {invite.group.currency}</p>
            {invite.group.description ? <p><strong>Description:</strong> {invite.group.description}</p> : null}
            {invite.expiresAt ? (
              <p><strong>Expires:</strong> {new Date(invite.expiresAt).toLocaleString()}</p>
            ) : null}
          </div>

          {!user && invite.kind === "direct" ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              Sign in or create an account to accept this email invite.
              {invite.inviteeEmail ? ` Use ${invite.inviteeEmail} if possible.` : ""}
            </div>
          ) : null}

          {!isPending ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              This invite is currently marked as <strong>{invite.status}</strong>.
            </div>
          ) : null}

          <Button
            onClick={() => void handleAcceptInvitation()}
            className="w-full"
            disabled={submitting || !isPending}
          >
            {submitting ? <Spinner /> : buttonLabel}
          </Button>

          {!user ? (
            <Button
              variant="secondary"
              onClick={() => navigate(authTargets.signup)}
              className="w-full"
              disabled={submitting || !isPending}
            >
              Create account first
            </Button>
          ) : null}

          <Button variant="secondary" onClick={() => navigate("/")} className="w-full">
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
