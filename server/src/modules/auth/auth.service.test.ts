import test from "node:test";
import assert from "node:assert/strict";
import { authService } from "./auth.service.js";

test("buildOAuthResultRedirect creates success callback URL", () => {
  const url = authService.buildOAuthResultRedirect({ ok: true });
  const parsed = new URL(url);

  assert.equal(parsed.pathname, "/oauth/callback");
  assert.equal(parsed.searchParams.get("status"), "success");
  assert.equal(parsed.searchParams.get("code"), null);
});

test("buildOAuthResultRedirect normalizes error code", () => {
  const url = authService.buildOAuthResultRedirect({
    ok: false,
    code: "GOOGLE_OAUTH_NOT_CONFIGURED!",
  });
  const parsed = new URL(url);

  assert.equal(parsed.searchParams.get("status"), "error");
  assert.equal(parsed.searchParams.get("code"), "oauth_google_oauth_not_configured_");
});
