CREATE TABLE IF NOT EXISTS expense_member_discounts (
  expense_member_discount_id SERIAL PRIMARY KEY,
  expense_id                 INT            NOT NULL REFERENCES expenses(expense_id) ON DELETE CASCADE,
  user_id                    INT            NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  discount_type              VARCHAR(20)    NOT NULL,
  rate_percent               NUMERIC(5,2)   NOT NULL DEFAULT 20.00,
  created_at                 TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                 TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_expense_member_discount_type
    CHECK (discount_type IN ('pwd', 'senior')),
  CONSTRAINT uniq_expense_member_discount
    UNIQUE (expense_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_expense_member_discounts_expense
  ON expense_member_discounts (expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_member_discounts_user
  ON expense_member_discounts (user_id);
