import pg from "pg";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const { Pool } = pg;
const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || "5432"),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

const ses = new SESClient({ region: process.env.AWS_REGION || "ap-southeast-1" });

export const handler = async () => {
  console.log("Starting unified debt reminders generation...");
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    // Threshold for reminder (e.g., older than 3 days)
    const thresholdDays = 3;
    
    // 1. Get all users who have unsettled debts
    const usersQuery = `
      SELECT DISTINCT u.user_id, u.email, u.name
      FROM users u
      JOIN expense_splits es ON u.user_id = es.user_id
      JOIN expenses e ON es.expense_id = e.expense_id
      WHERE es.is_settled = false 
        AND e.created_at < (CURRENT_TIMESTAMP - INTERVAL '${thresholdDays} days')
    `;
    const { rows: users } = await client.query(usersQuery);
    console.log(`Found ${users.length} users with unsettled debts.`);

    let totalSent = 0;

    for (const user of users) {
      // 2. For each user, get all their unsettled debts
      const debtsQuery = `
        SELECT 
          e.title_description, 
          es.amount_owed, 
          g.name as group_name,
          p.name as payer_name,
          EXTRACT(DAY FROM (CURRENT_TIMESTAMP - e.created_at)) as days_outstanding
        FROM expense_splits es
        JOIN expenses e ON es.expense_id = e.expense_id
        JOIN groups g ON e.group_id = g.group_id
        JOIN users p ON e.payer_user_id = p.user_id
        WHERE es.user_id = $1 AND es.is_settled = false
          AND e.created_at < (CURRENT_TIMESTAMP - INTERVAL '${thresholdDays} days')
        ORDER BY days_outstanding DESC
      `;
      const { rows: debts } = await client.query(debtsQuery, [user.user_id]);

      const totalOwed = debts.reduce((sum, d) => sum + parseFloat(d.amount_owed), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const debtsHtml = debts.map(d => `
        <tr style="border-bottom: 1px solid #f5f7fa;">
          <td style="padding: 16px 0;">
            <div style="font-size: 15px; font-weight: 700; color: #0a0f1a;">${d.title_description}</div>
            <div style="font-size: 13px; color: #9aa3b2;">${d.group_name} &bull; Owed to <strong>${d.payer_name}</strong></div>
          </td>
          <td style="padding: 16px 0; text-align: right;">
            <div style="font-size: 16px; font-weight: 800; color: #0a0f1a;">₱${parseFloat(d.amount_owed).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div style="font-size: 12px; color: #c83a3a; font-weight: 600;">${Math.floor(d.days_outstanding)} days ago</div>
          </td>
        </tr>
      `).join('');

      // 3. SES Email
      if (process.env.SMTP_FROM) {
        const htmlBody = `
          <!DOCTYPE html>
          <html>
          <body style="font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif; background-color: #ecf7f4; margin: 0; padding: 40px 0;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(10, 15, 26, 0.05);">
              <div style="background-color: #0a0f1a; padding: 40px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.02em;">Debt Reminder</h1>
                <p style="color: rgba(255,255,255,0.7); margin-top: 8px; font-size: 16px; font-weight: 500;">KWH Split</p>
              </div>
              
              <div style="padding: 40px;">
                <p style="font-size: 16px; color: #1c2434; line-height: 1.6;">Hi ${user.name},</p>
                <p style="font-size: 16px; color: #4a5468; line-height: 1.6;">You have some unsettled debts across your groups. Please take a moment to settle them:</p>
                
                <div style="background-color: #fef2f2; border: 1px solid #fee2e2; padding: 32px; border-radius: 16px; margin: 32px 0; text-align: center;">
                  <div style="font-size: 14px; color: #c83a3a; text-transform: uppercase; font-weight: 700; margin-bottom: 8px; letter-spacing: 0.05em;">Total Outstanding</div>
                  <div style="font-size: 42px; font-weight: 800; color: #0a0f1a;">₱${totalOwed}</div>
                </div>

                <h2 style="font-size: 18px; font-weight: 700; color: #0a0f1a; margin-top: 40px; margin-bottom: 20px;">Breakdown</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="text-align: left; border-bottom: 2px solid #e6eaf0;">
                      <th style="padding-bottom: 12px; font-size: 12px; text-transform: uppercase; color: #9aa3b2; font-weight: 700; letter-spacing: 0.05em;">Debt Details</th>
                      <th style="padding-bottom: 12px; font-size: 12px; text-transform: uppercase; color: #9aa3b2; font-weight: 700; letter-spacing: 0.05em; text-align: right;">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${debtsHtml}
                  </tbody>
                </table>

                <p style="font-size: 15px; color: #6b778c; line-height: 1.6; text-align: center; margin-top: 40px;">Settling your debts promptly helps keep the group balance transparent and fair for everyone.</p>

                <div style="margin-top: 48px; text-align: center;">
                  <a href="${process.env.WEB_ORIGIN || 'https://kwhsplit.app'}/dashboard" style="background-color: #c83a3a; color: #ffffff; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(200, 58, 58, 0.2);">Settle Now</a>
                </div>
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
            Source: process.env.SMTP_FROM,
            Destination: { ToAddresses: [user.email] },
            Message: {
              Subject: { Data: `Debt Reminder: KWH Split` },
              Body: {
                Html: { Data: htmlBody },
                Text: { Data: `Hi ${user.name},\n\nYou have unsettled debts totaling ₱${totalOwed}. Please settle your balances on KWH Split.` }
              }
            }
          }));
          totalSent++;
        } catch (emailErr) {
          console.error(`Failed to send debt reminder SES email to ${user.email}`, emailErr);
        }
      }
    }

    await client.query("COMMIT");
    console.log(`Unified debt reminders sent to ${totalSent} users.`);
    return { ok: true, usersReminded: totalSent };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to generate unified debt reminders", err);
    throw err;
  } finally {
    client.release();
  }
};
