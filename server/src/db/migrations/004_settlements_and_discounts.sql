-- Settlements ledger for group payment tracking.
-- Additive-only migration to keep existing expense flow unchanged.

CREATE TABLE IF NOT EXISTS settlement_events (
  settlement_event_id SERIAL PRIMARY KEY,
  group_id            INT            NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  from_user_id        INT            NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  to_user_id          INT            NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  amount_paid         NUMERIC(10, 2) NOT NULL CHECK (amount_paid > 0),
  note                TEXT,
  reference           VARCHAR(120),
  paid_at             TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_settlement_events_group ON settlement_events (group_id);
CREATE INDEX IF NOT EXISTS idx_settlement_events_from_user ON settlement_events (from_user_id);
CREATE INDEX IF NOT EXISTS idx_settlement_events_to_user ON settlement_events (to_user_id);
