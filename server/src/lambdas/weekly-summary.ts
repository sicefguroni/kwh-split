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
  console.log("Starting unified weekly summary generation...");
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    // Calculate the start and end dates for the previous week
    const now = new Date();
    const endOfWeek = new Date(now);
    endOfWeek.setHours(23, 59, 59, 999);
    
    const startOfWeek = new Date(endOfWeek);
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);

    console.log(`Aggregating expenses between ${startOfWeek.toISOString()} and ${endOfWeek.toISOString()}`);

    // 1. Get all users who are members of groups that had activity this week
    const usersQuery = `
      SELECT DISTINCT u.user_id, u.email, u.name
      FROM users u
      JOIN group_members gm ON u.user_id = gm.user_id
      JOIN expenses e ON gm.group_id = e.group_id
      WHERE e.created_at >= $1 AND e.created_at <= $2
    `;
    const { rows: users } = await client.query(usersQuery, [startOfWeek, endOfWeek]);
    console.log(`Found ${users.length} users with activity.`);

    for (const user of users) {
      // 2. For each user, get aggregated data across all their groups
      const statsQuery = `
        SELECT 
          SUM(e.total_amount) as total_spent,
          COUNT(e.expense_id) as expense_count,
          COUNT(DISTINCT e.group_id) as group_count
        FROM expenses e
        JOIN group_members gm ON e.group_id = gm.group_id
        WHERE gm.user_id = $1 AND e.created_at >= $2 AND e.created_at <= $3
      `;
      const { rows: [stats] } = await client.query(statsQuery, [user.user_id, startOfWeek, endOfWeek]);

      // New: Get current unsettled dues (Total Balance)
      const duesOwedQuery = `
        SELECT COALESCE(SUM(amount_owed), 0) as total_owed
        FROM expense_splits
        WHERE user_id = $1 AND is_settled = false
      `;
      const { rows: [{ total_owed }] } = await client.query(duesOwedQuery, [user.user_id]);

      const duesToReceiveQuery = `
        SELECT COALESCE(SUM(es.amount_owed), 0) as total_to_receive
        FROM expense_splits es
        JOIN expenses e ON es.expense_id = e.expense_id
        WHERE e.payer_user_id = $1 AND es.is_settled = false AND es.user_id != $1
      `;
      const { rows: [{ total_to_receive }] } = await client.query(duesToReceiveQuery, [user.user_id]);

      // 3. Get top 5 expenses across all their groups
      const topExpensesQuery = `
        SELECT 
          e.title_description, 
          e.total_amount, 
          payer.name as paid_by,
          g.name as group_name
        FROM expenses e
        JOIN groups g ON e.group_id = g.group_id
        JOIN users payer ON e.payer_user_id = payer.user_id
        JOIN group_members gm ON e.group_id = gm.group_id
        WHERE gm.user_id = $1 AND e.created_at >= $2 AND e.created_at <= $3
        ORDER BY e.total_amount DESC
        LIMIT 5
      `;
      const { rows: topExpenses } = await client.query(topExpensesQuery, [user.user_id, startOfWeek, endOfWeek]);

      const totalSpent = parseFloat(stats.total_spent || "0").toFixed(2);
      const topExpensesHtml = topExpenses.map(exp => `
        <tr style="border-bottom: 1px solid #edf2f7;">
          <td style="padding: 12px 0;">
            <div style="color: #4a5568; font-weight: 500;">${exp.title_description}</div>
            <div style="color: #a0aec0; font-size: 11px; text-transform: uppercase;">${exp.group_name}</div>
          </td>
          <td style="padding: 12px 0; color: #718096; text-align: center;">${exp.paid_by}</td>
          <td style="padding: 12px 0; color: #2d3748; font-weight: 600; text-align: right;">₱${parseFloat(exp.total_amount).toFixed(2)}</td>
        </tr>
      `).join('');

        // 4. SES Email
        if (process.env.SMTP_FROM) {
          const htmlBody = `
            <!DOCTYPE html>
            <html>
            <body style="font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif; background-color: #ecf7f4; margin: 0; padding: 40px 0;">
              <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(10, 15, 26, 0.05);">
                <div style="background: linear-gradient(135deg, #3d9689 0%, #2f7a71 100%); padding: 40px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.02em;">Weekly Summary</h1>
                  <p style="color: rgba(255,255,255,0.9); margin-top: 8px; font-size: 16px; font-weight: 500;">All your groups activity</p>
                </div>
                
                <div style="padding: 40px;">
                  <p style="font-size: 16px; color: #1c2434; line-height: 1.6;">Hi ${user.name},</p>
                  <p style="font-size: 16px; color: #4a5468; line-height: 1.6;">Here's a summary of activity across your <strong>${stats.group_count} active groups</strong> this past week:</p>
                  
                  <div style="display: flex; gap: 16px; margin: 32px 0;">
                    <div style="flex: 1; background-color: #f5f7fa; padding: 20px; border-radius: 16px; text-align: center; border: 1px solid #e6eaf0;">
                      <div style="font-size: 14px; color: #6b778c; margin-bottom: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Total Spent</div>
                      <div style="font-size: 28px; font-weight: 800; color: #0a0f1a;">₱${totalSpent}</div>
                    </div>
                    <div style="flex: 1; background-color: #f5f7fa; padding: 20px; border-radius: 16px; text-align: center; border: 1px solid #e6eaf0;">
                      <div style="font-size: 14px; color: #6b778c; margin-bottom: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Expenses</div>
                      <div style="font-size: 28px; font-weight: 800; color: #0a0f1a;">${stats.expense_count}</div>
                    </div>
                  </div>

                  <h2 style="font-size: 18px; font-weight: 700; color: #0a0f1a; margin-top: 40px; margin-bottom: 20px;">Current Balance</h2>
                  <div style="background-color: #ffffff; border: 1px solid #e6eaf0; border-radius: 16px; overflow: hidden; display: flex;">
                    <div style="flex: 1; padding: 20px; border-right: 1px solid #e6eaf0; text-align: center;">
                      <div style="font-size: 12px; color: #9aa3b2; text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">You Owe</div>
                      <div style="font-size: 20px; font-weight: 800; color: #c83a3a;">₱${Number(total_owed).toLocaleString()}</div>
                    </div>
                    <div style="flex: 1; padding: 20px; text-align: center;">
                      <div style="font-size: 12px; color: #9aa3b2; text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">You're Owed</div>
                      <div style="font-size: 20px; font-weight: 800; color: #18a06b;">₱${Number(total_to_receive).toLocaleString()}</div>
                    </div>
                  </div>

                  <h2 style="font-size: 18px; font-weight: 700; color: #0a0f1a; margin-top: 40px; margin-bottom: 20px;">Top Activity</h2>
                  <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                      <tr style="text-align: left; border-bottom: 2px solid #e6eaf0;">
                        <th style="padding-bottom: 12px; font-size: 12px; text-transform: uppercase; color: #9aa3b2; font-weight: 700; letter-spacing: 0.05em;">Expense</th>
                        <th style="padding-bottom: 12px; font-size: 12px; text-transform: uppercase; color: #9aa3b2; font-weight: 700; letter-spacing: 0.05em; text-align: center;">Paid By</th>
                        <th style="padding-bottom: 12px; font-size: 12px; text-transform: uppercase; color: #9aa3b2; font-weight: 700; letter-spacing: 0.05em; text-align: right;">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${topExpensesHtml}
                    </tbody>
                  </table>

                  <div style="margin-top: 48px; text-align: center;">
                    <a href="${process.env.WEB_ORIGIN || 'https://kwhsplit.app'}/dashboard" style="background-color: #3d9689; color: #ffffff; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(61, 150, 137, 0.2);">View All Groups</a>
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
              Subject: { Data: `Weekly Summary: Activity across all your groups` },
              Body: {
                Html: { Data: htmlBody },
                Text: { Data: `Hi ${user.name},\n\nA total of ₱${totalSpent} was spent across your groups this past week. Check the details on Split!` }
              }
            }
          }));
        } catch (emailErr) {
          console.error(`Failed to send weekly summary SES email to ${user.email}`, emailErr);
        }
      }
      
      // 5. Still create a notification for each group (optional, but keep it simple for now by just doing one for 'all')
      await client.query(`
        INSERT INTO group_notifications (user_id, group_id, type, title, message)
        SELECT gm.user_id, gm.group_id, 'weekly_summary', 'Weekly Summary Available', 'Your unified weekly summary has been sent.'
        FROM group_members gm
        WHERE gm.user_id = $1
        LIMIT 1
      `, [user.user_id]);
    }

    // 6. Historic Records (Optional: Keep it per group for data integrity if needed)
    // For now, I'll skip the weekly_summaries table insert or just do it once per group separately.
    const groupSummaryQuery = `
      SELECT group_id, SUM(total_amount) as total_spent, count(expense_id) as expense_count
      FROM expenses
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY group_id
    `;
    const { rows: groupRows } = await client.query(groupSummaryQuery, [startOfWeek, endOfWeek]);
    for (const groupRow of groupRows) {
      const payload = {
        total_spent: parseFloat(groupRow.total_spent).toFixed(2),
        expense_count: groupRow.expense_count,
        start_date: startOfWeek.toISOString(),
        end_date: endOfWeek.toISOString()
      };
      await client.query(`
        INSERT INTO weekly_summaries (group_id, start_date, end_date, total_expenses, payload)
        VALUES ($1, $2, $3, $4, $5)
      `, [groupRow.group_id, startOfWeek, endOfWeek, groupRow.total_spent, payload]);
    }

    await client.query("COMMIT");
    console.log("Weekly summaries generated and sent successfully.");
    return { ok: true, usersNotified: users.length };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to generate weekly summaries", err);
    throw err;
  } finally {
    client.release();
  }
};
