import { hashPassword, verifyPassword } from "../../utils/password.js";
import { signAccessToken, signRefreshToken } from "../../utils/jwt.js";
import { badRequest, conflict, unauthorized } from "../../utils/errors.js";
import {
  userRepository,
  type AuthProvider,
  type UserRecord,
} from "./auth.repository.js";
import type { LoginInput, SignupInput } from "./auth.schemas.js";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface AuthResult {
  user: PublicUser;
  tokens: { accessToken: string; refreshToken: string };
}

interface OAuthStatePayload {
  provider: AuthProvider;
  nonce: string;
  redirectPath?: string;
}

interface OAuthIdentity {
  provider: AuthProvider;
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatarUrl: string | null;
}

const toPublicUser = (record: UserRecord): PublicUser => ({
  id: String(record.user_id),
  email: record.email,
  name: record.name,
  createdAt: record.created_at.toISOString(),
});

const issueTokens = async (
  userId: string,
): Promise<{ accessToken: string; refreshToken: string }> => ({
  accessToken: await signAccessToken(userId),
  refreshToken: await signRefreshToken(userId),
});

const parseUserId = (subject: string): number => {
  const parsed = Number.parseInt(subject, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw unauthorized("Invalid session");
  }
  return parsed;
};

const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const oauthCallbackUrl = (provider: AuthProvider): string =>
  `${env.OAUTH_CALLBACK_BASE_URL}/api/auth/${provider}/callback`;

const encodeParams = (params: Record<string, string>): string =>
  new URLSearchParams(params).toString();

const parseBoolean = (value: unknown): boolean =>
  value === true || value === "true" || value === 1 || value === "1";

const parseOAuthErrorCode = (errorCode: string): string =>
  `oauth_${errorCode.toLowerCase().replaceAll(/[^a-z0-9_]+/g, "_")}`;

const assertProviderConfig = (provider: AuthProvider): void => {
  if (provider === "google" && (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET)) {
    throw badRequest("Google OAuth is not configured", "google_oauth_not_configured");
  }
};

const createOAuthStateToken = async (payload: OAuthStatePayload): Promise<string> =>
  await new SignJWT({
    provider: payload.provider,
    nonce: payload.nonce,
    ...(payload.redirectPath ? { redirectPath: payload.redirectPath } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(env.JWT_SECRET));

const verifyOAuthStateToken = async (token: string): Promise<OAuthStatePayload> => {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(env.JWT_SECRET), {
    algorithms: ["HS256"],
  });
  const provider = payload.provider;
  const nonce = payload.nonce;
  if (provider !== "google" || typeof nonce !== "string") {
    throw badRequest("Invalid OAuth state", "invalid_oauth_state");
  }
  return {
    provider,
    nonce,
    ...(typeof payload.redirectPath === "string"
      ? { redirectPath: payload.redirectPath }
      : {}),
  };
};

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw badRequest("OAuth provider rejected request", "oauth_provider_request_failed");
  }
  return (await response.json()) as T;
};

const getGoogleIdentity = async (code: string): Promise<OAuthIdentity> => {
  assertProviderConfig("google");
  const clientId = env.GOOGLE_CLIENT_ID!;
  const clientSecret = env.GOOGLE_CLIENT_SECRET!;
  const tokens = await fetchJson<{ id_token?: string }>(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: encodeParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: oauthCallbackUrl("google"),
        grant_type: "authorization_code",
      }),
    },
  );
  if (!tokens.id_token) {
    throw badRequest("Google login failed", "google_missing_id_token");
  }

  const verified = await jwtVerify(tokens.id_token, GOOGLE_JWKS, {
    audience: clientId,
  });
  const issuer = verified.payload.iss;
  if (!issuer || typeof issuer !== "string" || !GOOGLE_ISSUERS.has(issuer)) {
    throw badRequest("Google token issuer invalid", "google_invalid_issuer");
  }
  const subject = verified.payload.sub;
  const email = verified.payload.email;
  const name = verified.payload.name;
  if (typeof subject !== "string" || typeof email !== "string" || typeof name !== "string") {
    throw badRequest("Google profile missing required fields", "google_profile_incomplete");
  }

  return {
    provider: "google",
    providerUserId: subject,
    email: email.toLowerCase(),
    emailVerified: parseBoolean(verified.payload.email_verified),
    name,
    avatarUrl: typeof verified.payload.picture === "string" ? verified.payload.picture : null,
  };
};

export const authService = {
  async signup(input: SignupInput): Promise<AuthResult> {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw conflict("Email already registered", "email_taken");
    }

    const passwordHash = await hashPassword(input.password);
    const user = await userRepository.create({
      email: input.email,
      name: input.name,
      passwordHash,
    });

    const publicUser = toPublicUser(user);
    const tokens = await issueTokens(publicUser.id);
    return { user: publicUser, tokens };
  },

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await userRepository.findByEmail(input.email);
    if (!user || !user.is_active) {
      throw unauthorized("Invalid email or password");
    }

    const ok = await verifyPassword(input.password, user.password);
    if (!ok) {
      throw unauthorized("Invalid email or password");
    }

    const publicUser = toPublicUser(user);
    const tokens = await issueTokens(publicUser.id);
    return { user: publicUser, tokens };
  },

  async getCurrentUser(subject: string): Promise<PublicUser> {
    const user = await userRepository.findById(parseUserId(subject));
    if (!user || !user.is_active) {
      throw unauthorized("Session user no longer exists");
    }
    return toPublicUser(user);
  },

  async createProviderStartUrl(
    provider: AuthProvider,
    redirectPath?: string,
  ): Promise<{ authorizationUrl: string; stateToken: string; stateNonce: string }> {
    assertProviderConfig(provider);
    const stateNonce = randomUUID();
    const stateToken = await createOAuthStateToken(
      redirectPath ? { provider, nonce: stateNonce, redirectPath } : { provider, nonce: stateNonce },
    );

    const common = {
      state: stateNonce,
      redirect_uri: oauthCallbackUrl(provider),
    };
    if (provider === "google") {
      const clientId = env.GOOGLE_CLIENT_ID!;
      return {
        authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${encodeParams({
          ...common,
          client_id: clientId,
          response_type: "code",
          scope: "openid email profile",
          access_type: "offline",
          prompt: "select_account",
        })}`,
        stateToken,
        stateNonce,
      };
    }

    throw badRequest("Unsupported OAuth provider", "oauth_provider_unsupported");
  },

  async completeProviderAuth(input: {
    provider: AuthProvider;
    code: string;
    returnedState: string;
    stateToken: string;
  }): Promise<AuthResult> {
    const state = await verifyOAuthStateToken(input.stateToken);
    if (state.provider !== input.provider || state.nonce !== input.returnedState) {
      throw badRequest("OAuth state mismatch", "oauth_state_mismatch");
    }

    const identity = await getGoogleIdentity(input.code);

    if (!identity.emailVerified) {
      throw badRequest("Verified email is required", "oauth_email_unverified");
    }

    const linked = await userRepository.findProviderIdentity(
      identity.provider,
      identity.providerUserId,
    );
    let user = linked ? await userRepository.findById(linked.user_id) : null;

    if (!user) {
      const existingByEmail = await userRepository.findByEmail(identity.email);
      if (existingByEmail) {
        user = existingByEmail;
      } else {
        const passwordHash = await hashPassword(randomUUID());
        user = await userRepository.create({
          email: identity.email,
          name: identity.name,
          passwordHash,
          avatarUrl: identity.avatarUrl,
          emailVerified: identity.emailVerified,
        });
      }
    }
    if (!user.is_active) {
      throw unauthorized("Account is disabled");
    }

    await userRepository.attachProviderToUser({
      userId: user.user_id,
      provider: identity.provider,
      providerUserId: identity.providerUserId,
      providerEmail: identity.email,
    });

    const publicUser = toPublicUser(user);
    const tokens = await issueTokens(publicUser.id);
    return { user: publicUser, tokens };
  },

  buildOAuthResultRedirect(input: { ok: boolean; code?: string }): string {
    const base = new URL("/oauth/callback", env.WEB_ORIGIN);
    base.searchParams.set("status", input.ok ? "success" : "error");
    if (input.code) {
      base.searchParams.set("code", parseOAuthErrorCode(input.code));
    }
    return base.toString();
  },
};
