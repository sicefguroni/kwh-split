import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { env } from "../../config/env.js";

export type GroupInviteDeliveryStatus = "sent" | "skipped" | "failed";

let cachedSesClient: SESClient | null = null;

const isSesConfigured = (): boolean =>
  Boolean(env.SMTP_FROM); // We still use SMTP_FROM as the 'Source' address for SES

const getSesClient = (): SESClient | null => {
  if (!isSesConfigured()) {
    return null;
  }

  if (cachedSesClient) {
    return cachedSesClient;
  }

  cachedSesClient = new SESClient({
    region: process.env.AWS_REGION || "us-east-1",
  });

  return cachedSesClient;
};

export async function sendGroupInvitationEmail(input: {
  to: string;
  inviterName: string;
  groupName: string;
  inviteUrl: string;
  expiresAt: Date;
}): Promise<GroupInviteDeliveryStatus> {
  const ses = getSesClient();
  if (!ses || !env.SMTP_FROM) {
    return "skipped";
  }

  const textBody = [
    `${input.inviterName} invited you to join "${input.groupName}" on Split.`,
    "",
    `Open this invite: ${input.inviteUrl}`,
    "If you already have an account, sign in to accept the invite.",
    "If you are new to Split, create an account first and then continue from the invite page.",
    `This invite expires on ${input.expiresAt.toISOString()}.`,
  ].join("\n");

  const htmlBody = `
  <div style="background-color: #f9fafb; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <tr>
        <td style="padding: 40px 32px;">
          <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #111827; line-height: 32px;">
            You've been invited!
          </h1>
          <p style="margin: 0 0 24px; font-size: 16px; line-height: 24px; color: #4b5563;">
            Hello! <strong>${escapeHtml(input.inviterName)}</strong> has invited you to join the group 
            <span style="color: #111827; font-weight: 600;">"${escapeHtml(input.groupName)}"</span> on Split.
          </p>
          
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
            <tr>
              <td align="center">
                <a href="${escapeAttribute(input.inviteUrl)}" 
                   style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; font-weight: 600; font-size: 16px; text-decoration: none; border-radius: 8px;">
                   Accept Invitation
                </a>
              </td>
            </tr>
          </table>

          <div style="padding: 16px; background-color: #f3f4f6; border-radius: 8px; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 20px;">
              <strong>Note:</strong> If you're new to Split, please create an account first, then return to the invite page to join the group.
            </p>
          </div>

          <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
            This invitation will expire on ${escapeHtml(input.expiresAt.toLocaleDateString())} at ${escapeHtml(input.expiresAt.toLocaleTimeString())}.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding: 24px; background-color: #f9fafb; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 14px; color: #9ca3af;">
            Sent by Split &bull; Manage your expenses with ease.
          </p>
        </td>
      </tr>
    </table>
  </div>
`;

  try {
    await ses.send(new SendEmailCommand({
      Source: env.SMTP_FROM,
      Destination: {
        ToAddresses: [input.to],
      },
      Message: {
        Subject: {
          Data: `${input.inviterName} invited you to join ${input.groupName}`,
          Charset: "UTF-8",
        },
        Body: {
          Text: {
            Data: textBody,
            Charset: "UTF-8",
          },
          Html: {
            Data: htmlBody,
            Charset: "UTF-8",
          },
        },
      },
    }));
    return "sent";
  } catch (error) {
    console.error("Failed to send group invitation email via SES", error);
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
