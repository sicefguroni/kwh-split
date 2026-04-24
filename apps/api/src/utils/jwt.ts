import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "../config/env.js";

const secret = new TextEncoder().encode(env.JWT_SECRET);
const ISSUER = "split.api";
const AUDIENCE = "split.web";

export interface AccessTokenClaims extends JWTPayload {
  sub: string;
  typ: "access";
}

export interface RefreshTokenClaims extends JWTPayload {
  sub: string;
  typ: "refresh";
}

export const signAccessToken = (userId: string): Promise<string> =>
  new SignJWT({ typ: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${env.JWT_ACCESS_TTL_SECONDS}s`)
    .sign(secret);

export const signRefreshToken = (userId: string): Promise<string> =>
  new SignJWT({ typ: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${env.JWT_REFRESH_TTL_SECONDS}s`)
    .sign(secret);

export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, secret, {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (payload["typ"] !== "access" || typeof payload.sub !== "string") {
    throw new Error("Invalid access token");
  }
  return payload as AccessTokenClaims;
}

export async function verifyRefreshToken(
  token: string,
): Promise<RefreshTokenClaims> {
  const { payload } = await jwtVerify(token, secret, {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (payload["typ"] !== "refresh" || typeof payload.sub !== "string") {
    throw new Error("Invalid refresh token");
  }
  return payload as RefreshTokenClaims;
}
