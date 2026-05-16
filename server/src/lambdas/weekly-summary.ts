import pg from "pg";

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("rds.amazonaws.com")
    ? { rejectUnauthorized: false }
    : undefined,
});

export const handler = async () => {
  console.log("Starting weekly summary generation...");
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    // Calculate the start and end dates for the previous week
    const now = new Date();
    // Go to previous Sunday 23:59
    const endOfWeek = new Date(now);
    endOfWeek.setHours(23, 59, 59, 999);
    
    const startOfWeek = new Date(endOfWeek);
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);

    console.log(`Aggregating expenses between ${startOfWeek.toISOString()} and ${endOfWeek.toISOString()}`);

    // Find all groups with expenses in the last 7 days
    const query = `
      SELECT group_id, SUM(total_amount) as total_spent, count(expense_id) as expense_count
      FROM expenses
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY group_id
    `;
    
    const { rows } = await client.query(query, [startOfWeek, endOfWeek]);
    console.log(`Found ${rows.length} groups with activity.`);

    for (const row of rows) {
      const groupId = row.group_id;
      const totalSpent = row.total_spent;
      
      const payload = {
        total_spent: totalSpent,
        expense_count: row.expense_count,
        start_date: startOfWeek.toISOString(),
        end_date: endOfWeek.toISOString()
      };
      
      // Store summary in weekly_summaries
      await client.query(`
        INSERT INTO weekly_summaries (group_id, start_date, end_date, total_expenses, payload)
        VALUES ($1, $2, $3, $4, $5)
      `, [groupId, startOfWeek, endOfWeek, totalSpent, payload]);
      
      // Get all members of the group to notify them
      const members = await client.query(`SELECT user_id FROM group_members WHERE group_id = $1`, [groupId]);
      for (const member of members.rows) {
        await client.query(`
          INSERT INTO group_notifications (user_id, group_id, type, title, message)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          member.user_id,
          groupId,
          'weekly_summary',
          'Weekly Expense Summary',
          `Your group spent $${totalSpent} this week.`
        ]);
      }
    }
    
    await client.query("COMMIT");
    console.log("Weekly summaries generated successfully.");
    return { ok: true, processedGroups: rows.length };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to generate weekly summaries", err);
    throw err;
  } finally {
    client.release();
  }
};
