import pg from "pg";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("rds.amazonaws.com")
    ? { rejectUnauthorized: false }
    : undefined,
});

const sns = new SNSClient({ region: process.env.AWS_REGION || "us-east-1" });
const ses = new SESClient({ region: process.env.AWS_REGION || "us-east-1" });

export const handler = async () => {
  console.log("Starting debt reminders check...");
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    const query = `
      SELECT s.split_id, s.user_id, s.amount_owed, s.created_at, u.email, u.name, e.title_description
      FROM expense_splits s
      JOIN users u ON s.user_id = u.user_id
      JOIN expenses e ON s.expense_id = e.expense_id
      WHERE s.is_settled = FALSE
        AND s.amount_owed > 0
    `;
    
    const { rows } = await client.query(query);
    console.log(`Found ${rows.length} unsettled debts.`);

    const now = new Date();
    let sentCount = 0;

    for (const row of rows) {
      const createdAt = new Date(row.created_at);
      const diffMs = now.getTime() - createdAt.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      // Notify if debt is exactly 3 days old or a multiple of 3 days
      if (diffDays > 0 && diffDays % 3 === 0) {
        console.log(`Sending reminder to user ${row.user_id} for split ${row.split_id} (${diffDays} days old)`);
        
        // 1. In-App Notification
        await client.query(`
          INSERT INTO group_notifications (user_id, type, title, message)
          VALUES ($1, $2, $3, $4)
        `, [
          row.user_id,
          'debt_reminder',
          'Unsettled Debt Reminder',
          `You still owe $${row.amount_owed} for "${row.title_description}". Please settle it.`
        ]);

        // 2. SES Email (or SNS if you prefer)
        if (process.env.SMTP_FROM) {
          try {
            await ses.send(new SendEmailCommand({
              Source: process.env.SMTP_FROM,
              Destination: { ToAddresses: [row.email] },
              Message: {
                Subject: { Data: "Debt Reminder: KWH Split" },
                Body: {
                  Text: { Data: `Hi ${row.name},\n\nYou have an unsettled debt of $${row.amount_owed} for "${row.title_description}". Please settle your balances on Split.` }
                }
              }
            }));
          } catch (emailErr) {
            console.error("Failed to send SES email", emailErr);
          }
        }
        
        sentCount++;
      }
    }
    
    await client.query("COMMIT");
    console.log(`Sent ${sentCount} reminders.`);
    return { ok: true, remindersSent: sentCount };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to process debt reminders", err);
    throw err;
  } finally {
    client.release();
  }
};
