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
    region: env.SES_REGION,
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
  <!DOCTYPE html>
  <html>
  <body style="font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif; background-color: #ecf7f4; margin: 0; padding: 40px 0;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(10, 15, 26, 0.05);">
      <div style="background-color: #0a0f1a; padding: 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.02em;">Group Invitation</h1>
        <p style="color: rgba(255,255,255,0.7); margin-top: 8px; font-size: 16px; font-weight: 500;">KWH Split</p>
      </div>
      
      <div style="padding: 40px;">
        <p style="font-size: 16px; color: #1c2434; line-height: 1.6;">Hi there!</p>
        <p style="font-size: 16px; color: #4a5468; line-height: 1.6;">
          <strong>${escapeHtml(input.inviterName)}</strong> has invited you to join the group 
          <span style="color: #0a0f1a; font-weight: 700;">"${escapeHtml(input.groupName)}"</span> on Split.
        </p>
        
        <div style="margin: 32px 0; text-align: center;">
          <a href="${escapeAttribute(input.inviteUrl)}" 
             style="background-color: #3d9689; color: #ffffff; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(61, 150, 137, 0.2);">
             Accept Invitation
          </a>
        </div>

        <div style="padding: 20px; background-color: #f5f7fa; border-radius: 16px; margin-bottom: 24px; border: 1px solid #e6eaf0;">
          <p style="margin: 0; font-size: 14px; color: #6b778c; line-height: 1.6;">
            <strong>Note:</strong> If you're new to Split, please create an account first, then return to the invite page to join the group.
          </p>
        </div>

        <p style="margin: 0; font-size: 12px; color: #9aa3b2; text-align: center;">
          This invitation will expire on ${escapeHtml(input.expiresAt.toLocaleDateString())} at ${escapeHtml(input.expiresAt.toLocaleTimeString())}.
        </p>
      </div>

      <div style="background-color: #f5f7fa; padding: 32px; text-align: center; border-top: 1px solid #e6eaf0;">
        <p style="font-size: 13px; color: #9aa3b2; margin: 0;">&copy; 2024 Split. Build healthy financial habits together.</p>
      </div>
    </div>
  </body>
  </html>
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
