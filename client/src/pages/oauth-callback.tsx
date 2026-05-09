import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Spinner } from "@/components/ui/spinner";
import { authApi } from "@/features/auth/api";
import { useCurrentUser } from "@/features/auth/use-auth";
import { queryClient } from "@/lib/query-client";
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
    let isMounted = true;

    const complete = async () => {
      if (status === "success") {
        if (!currentUser) {
          const { user } = await authApi.me();
          if (isMounted) {
            queryClient.setQueryData(["auth", "me"], user);
          }
        }
        if (isMounted) {
          navigate(redirectPath, { replace: true });
        }
        return;
      }

      if (isMounted) {
        navigate(getLoginRedirectForOauthError(errorMessage, redirectPath), { replace: true });
      }
    };

    void complete();

    return () => {
      isMounted = false;
    };
  }, [currentUser, errorMessage, navigate, redirectPath, status]);

  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <Spinner label="Completing sign in" />
    </main>
  );
}
