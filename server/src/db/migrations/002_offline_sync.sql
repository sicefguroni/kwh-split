-- Offline sync on canonical `expenses`: add stable client UUID + unique index; remove obsolete staging table if present.

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS client_expense_uuid UUID;

-- Multiple NULLs allowed; non-null client UUIDs must be unique (idempotent sync).
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_client_expense_uuid
  ON expenses (client_expense_uuid);

DROP TABLE IF EXISTS legacy_offline_expenses;
