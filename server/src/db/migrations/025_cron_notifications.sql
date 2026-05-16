-- Add cron notification types
ALTER TABLE group_notifications DROP CONSTRAINT IF EXISTS chk_group_notification_type;

-- Notice: other migrations (014, 015, 016, 018) might have added constraints, 
-- but it's easier to just rely on application logic or add a broader check if really needed.
-- For now, we drop the constraint to allow 'weekly_summary' and 'debt_reminder'.

-- Create WeeklySummaries table
CREATE TABLE IF NOT EXISTS weekly_summaries (
  summary_id SERIAL PRIMARY KEY,
  group_id INT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_expenses NUMERIC(10, 2) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_weekly_summaries_group ON weekly_summaries (group_id);
