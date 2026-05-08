-- Bridge legacy settlement_events schemas to the new event model.
-- Some existing DBs still enforce NOT NULL on legacy fields like payer_user_id.

ALTER TABLE settlement_events
  ADD COLUMN IF NOT EXISTS payer_user_id INT,
  ADD COLUMN IF NOT EXISTS payee_user_id INT,
  ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
  ADD COLUMN IF NOT EXISTS status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS payment_date TIMESTAMPTZ;

-- Backfill legacy columns from new columns when available.
UPDATE settlement_events
SET payer_user_id = COALESCE(payer_user_id, from_user_id)
WHERE payer_user_id IS NULL;

UPDATE settlement_events
SET payee_user_id = COALESCE(payee_user_id, to_user_id)
WHERE payee_user_id IS NULL;

UPDATE settlement_events
SET amount = COALESCE(amount, amount_paid)
WHERE amount IS NULL;

UPDATE settlement_events
SET payment_method = COALESCE(payment_method, 'other')
WHERE payment_method IS NULL;

UPDATE settlement_events
SET status = COALESCE(status, 'confirmed')
WHERE status IS NULL;

UPDATE settlement_events
SET payment_date = COALESCE(payment_date, paid_at, created_at, CURRENT_TIMESTAMP)
WHERE payment_date IS NULL;

-- Relax legacy strictness so new insert shape remains compatible.
ALTER TABLE settlement_events
  ALTER COLUMN payer_user_id DROP NOT NULL,
  ALTER COLUMN payee_user_id DROP NOT NULL,
  ALTER COLUMN amount DROP NOT NULL,
  ALTER COLUMN payment_method DROP NOT NULL,
  ALTER COLUMN status DROP NOT NULL,
  ALTER COLUMN payment_date DROP NOT NULL;

ALTER TABLE settlement_events
  ALTER COLUMN payment_method SET DEFAULT 'other',
  ALTER COLUMN status SET DEFAULT 'confirmed',
  ALTER COLUMN payment_date SET DEFAULT CURRENT_TIMESTAMP;
