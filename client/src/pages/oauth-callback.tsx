import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Spinner } from "@/components/ui/spinner";
import { useCurrentUser } from "@/features/auth/use-auth";
import { getLoginRedirectForOauthError, getOauthErrorMessage } from "./oauth-callback.utils";

export default function OauthCallbackPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const status = params.get("status");
  const code = params.get("code");
  const redirectPath = params.get("redirect") || "/dashboard";
  const { data: currentUser } = useCurrentUser();

  const errorMessage = useMemo(() => getOauthErrorMessage(code), [code]);

  useEffect(() => {
    if (status !== "success" && status !== "error") return;

    if (status === "error") {
      navigate(getLoginRedirectForOauthError(errorMessage, redirectPath), { replace: true });
      return;
    }

    if (currentUser === undefined) return;
    if (!currentUser) {
      navigate(getLoginRedirectForOauthError("Unable to verify session", redirectPath), { replace: true });
      return;
    }
    navigate(redirectPath, { replace: true });
  }, [currentUser, errorMessage, navigate, redirectPath, status]);

  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <Spinner label="Completing sign in" />
    </main>
  );
}
