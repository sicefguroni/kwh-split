const OAUTH_MESSAGES: Record<string, string> = {
  oauth_state_mismatch: "Could not verify sign-in request. Please try again.",
  oauth_email_unverified: "Your provider email must be verified before signing in.",
};

export const getOauthErrorMessage = (code: string | null): string | null => {
  if (!code) return null;
  return OAUTH_MESSAGES[code] ?? "Unable to sign in with that provider.";
};

export const getLoginRedirectForOauthError = (
  message: string | null,
  redirectPath?: string | null,
): string => {
  const params = new URLSearchParams();
  if (message) {
    params.set("oauthError", message);
  }
  if (redirectPath) {
    params.set("redirect", redirectPath);
  }
  return params.size > 0 ? `/login?${params.toString()}` : "/login";
};
