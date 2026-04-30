import { hashPassword, verifyPassword } from "../../utils/password.js";
import { signAccessToken, signRefreshToken } from "../../utils/jwt.js";
import { conflict, unauthorized } from "../../utils/errors.js";
import { userRepository, type UserRecord } from "./auth.repository.js";
import type { LoginInput, SignupInput } from "./auth.schemas.js";

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
};
