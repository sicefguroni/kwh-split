-- Add payer reference for end-to-end expense UX integration.
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS payer_user_id INT REFERENCES users(user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_payer_user ON expenses (payer_user_id);
