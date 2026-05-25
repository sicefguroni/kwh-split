-- 026: Multiple expense payers
-- Allow an expense to have multiple people who paid upfront.

CREATE TABLE IF NOT EXISTS expense_payers (
  id          SERIAL        PRIMARY KEY,
  expense_id  INT           NOT NULL REFERENCES expenses(expense_id) ON DELETE CASCADE,
  user_id     INT           NOT NULL REFERENCES users(user_id)       ON DELETE CASCADE,
  amount_paid NUMERIC(10,2) NOT NULL CHECK (amount_paid > 0),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_expense_user UNIQUE (expense_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_expense_payers_expense ON expense_payers (expense_id);

-- Backfill from the legacy payer_user_id column.
INSERT INTO expense_payers (expense_id, user_id, amount_paid)
SELECT expense_id, payer_user_id, total_amount
FROM expenses
WHERE payer_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM expense_payers ep
    WHERE ep.expense_id = expenses.expense_id
  );
