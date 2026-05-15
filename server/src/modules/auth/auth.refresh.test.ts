import test from "node:test";
import assert from "node:assert/strict";
import { signRefreshToken, verifyRefreshToken } from "../../utils/jwt.js";
import { HttpError } from "../../utils/errors.js";
import { authService } from "./auth.service.js";

test("refreshFromRefreshCookie rejects invalid token string", async () => {
  await assert.rejects(() => authService.refreshFromRefreshCookie("not-a-jwt"), (err: unknown) => {
    assert.ok(err instanceof HttpError);
    assert.equal(err.status, 401);
    return true;
  });
});

test("refreshFromRefreshCookie rejects malformed JWT", async () => {
  const fake =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwidHlwIjoicmVmcmVzaCJ9.invalidsig";
  await assert.rejects(() => authService.refreshFromRefreshCookie(fake));
});

test("refresh token signs and verifies with typ refresh", async () => {
  const refresh = await signRefreshToken("42");
  const claims = await verifyRefreshToken(refresh);
  assert.equal(claims.sub, "42");
  assert.equal(claims.typ, "refresh");
});

test("refreshFromRefreshCookie rejects when user does not exist", async () => {
  const refresh = await signRefreshToken(String(Number.MAX_SAFE_INTEGER));
  await assert.rejects(() => authService.refreshFromRefreshCookie(refresh), (err: unknown) => {
    assert.ok(err instanceof HttpError);
    assert.equal(err.status, 401);
    return true;
  });
});
