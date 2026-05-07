-- Compatibility patch for existing settlement_events tables created before
-- the current settlements module shape.
-- Keeps migration additive and safe with IF NOT EXISTS guards.

CREATE TABLE IF NOT EXISTS settlement_events (
  settlement_event_id SERIAL PRIMARY KEY,
  group_id            INT,
  from_user_id        INT,
  to_user_id          INT,
  amount_paid         NUMERIC(10, 2),
  note                TEXT,
  reference           VARCHAR(120),
  paid_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ
);

ALTER TABLE settlement_events
  ADD COLUMN IF NOT EXISTS settlement_event_id SERIAL,
  ADD COLUMN IF NOT EXISTS group_id INT,
  ADD COLUMN IF NOT EXISTS from_user_id INT,
  ADD COLUMN IF NOT EXISTS to_user_id INT,
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS reference VARCHAR(120),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Backfill reasonable defaults only where data is missing.
UPDATE settlement_events
SET amount_paid = 0
WHERE amount_paid IS NULL;

UPDATE settlement_events
SET paid_at = CURRENT_TIMESTAMP
WHERE paid_at IS NULL;

UPDATE settlement_events
SET created_at = CURRENT_TIMESTAMP
WHERE created_at IS NULL;

UPDATE settlement_events
SET updated_at = CURRENT_TIMESTAMP
WHERE updated_at IS NULL;

-- Enforce defaults for future writes.
ALTER TABLE settlement_events
  ALTER COLUMN amount_paid SET DEFAULT 0,
  ALTER COLUMN paid_at SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_settlement_events_group ON settlement_events (group_id);
CREATE INDEX IF NOT EXISTS idx_settlement_events_from_user ON settlement_events (from_user_id);
CREATE INDEX IF NOT EXISTS idx_settlement_events_to_user ON settlement_events (to_user_id);
