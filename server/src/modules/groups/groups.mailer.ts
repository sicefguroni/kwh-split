import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/env.js";

export type GroupInviteDeliveryStatus = "sent" | "skipped" | "failed";

let cachedTransporter: Transporter | null = null;

const isSmtpConfigured = (): boolean =>
  Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_FROM);

const getTransporter = (): Transporter | null => {
  if (!isSmtpConfigured()) {
    return null;
  }

  if (cachedTransporter) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    ...(env.SMTP_USER
      ? {
          auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASSWORD ?? "",
          },
        }
      : {}),
  });

  return cachedTransporter;
};

export async function sendGroupInvitationEmail(input: {
  to: string;
  inviterName: string;
  groupName: string;
  inviteUrl: string;
  expiresAt: Date;
}): Promise<GroupInviteDeliveryStatus> {
  const transporter = getTransporter();
  if (!transporter || !env.SMTP_FROM) {
    return "skipped";
  }

  try {
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to: input.to,
      subject: `${input.inviterName} invited you to join ${input.groupName}`,
      text: [
        `${input.inviterName} invited you to join "${input.groupName}" on Split.`,
        "",
        `Open this invite: ${input.inviteUrl}`,
        "If you already have an account, sign in to accept the invite.",
        "If you are new to Split, create an account first and then continue from the invite page.",
        `This invite expires on ${input.expiresAt.toISOString()}.`,
      ].join("\n"),
      html: `
        <p><strong>${escapeHtml(input.inviterName)}</strong> invited you to join <strong>${escapeHtml(input.groupName)}</strong> on Split.</p>
        <p><a href="${escapeAttribute(input.inviteUrl)}">Open your invite</a></p>
        <p>If you already have an account, sign in to accept the invite. If you are new to Split, create an account first and continue from the invite page.</p>
        <p>This invite expires on ${escapeHtml(input.expiresAt.toISOString())}.</p>
      `,
    });
    return "sent";
  } catch (error) {
    console.error("Failed to send group invitation email", error);
    return "failed";
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
