import { describe, expect, it } from "vitest";
import {
  getLoginRedirectForOauthError,
  getOauthErrorMessage,
} from "./oauth-callback.utils";

describe("oauth callback helpers", () => {
  it("maps known provider error", () => {
    expect(getOauthErrorMessage("oauth_state_mismatch")).toContain("Could not verify");
  });

  it("falls back for unknown provider error", () => {
    expect(getOauthErrorMessage("unknown_code")).toBe("Unable to sign in with that provider.");
  });

  it("creates login redirect with encoded message", () => {
    const path = getLoginRedirectForOauthError("Could not verify sign-in request. Please try again.");
    expect(path.startsWith("/login?oauthError=")).toBe(true);
  });
});
