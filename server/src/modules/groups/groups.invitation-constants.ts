import { randomUUID } from "node:crypto";

/** Rate limit window for outbound email invites */
export const INVITE_WINDOW_MS = 60 * 60 * 1000;

/** Max invites per hour per admin */
export const MAX_INVITES_PER_WINDOW = 25;

export const INVITATION_EXPIRY_DAYS = 7;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createInvitationToken(): string {
  return `inv_${Date.now()}_${randomUUID().replaceAll("-", "")}`;
}

export function invitationExpiresAt(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);
  return expiresAt;
}
