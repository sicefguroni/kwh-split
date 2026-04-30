-- Split: initial schema
-- Canonical domain model for the group expense tracker.
-- All statements are idempotent so the migration runner can be replayed safely.

-- ---------- USERS ----------
CREATE TABLE IF NOT EXISTS users (
  user_id     SERIAL       PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- ---------- GROUPS ----------
CREATE TABLE IF NOT EXISTS groups (
  group_id    SERIAL       PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  currency    VARCHAR(10)  NOT NULL DEFAULT 'USD',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------- GROUP MEMBERS ----------
CREATE TABLE IF NOT EXISTS group_members (
  member_id   SERIAL       PRIMARY KEY,
  group_id    INT          NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  user_id     INT          NOT NULL REFERENCES users(user_id)   ON DELETE CASCADE,
  role        VARCHAR(50)  NOT NULL DEFAULT 'member',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_group_user UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members (group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user  ON group_members (user_id);

-- ---------- EXPENSES ----------
CREATE TABLE IF NOT EXISTS expenses (
  expense_id         SERIAL         PRIMARY KEY,
  group_id           INT            NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  title_description  VARCHAR(255)   NOT NULL,
  total_amount       NUMERIC(10, 2) NOT NULL,
  sale_date          DATE           NOT NULL,
  tax_amount         NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  tip_amount         NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  split_type         VARCHAR(50)    NOT NULL DEFAULT 'equal',
  receipt_items_flag BOOLEAN        NOT NULL DEFAULT FALSE,
  receipt_image_url  VARCHAR(500),
  created_at         TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses (group_id);

-- ---------- RECEIPT ITEMS ----------
CREATE TABLE IF NOT EXISTS receipt_items (
  item_id     SERIAL         PRIMARY KEY,
  expense_id  INT            NOT NULL REFERENCES expenses(expense_id) ON DELETE CASCADE,
  item_name   VARCHAR(255)   NOT NULL,
  price       NUMERIC(10, 2) NOT NULL,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_receipt_items_expense ON receipt_items (expense_id);

-- ---------- EXPENSE SPLITS ----------
CREATE TABLE IF NOT EXISTS expense_splits (
  split_id     SERIAL         PRIMARY KEY,
  expense_id   INT            NOT NULL REFERENCES expenses(expense_id) ON DELETE CASCADE,
  user_id      INT            NOT NULL REFERENCES users(user_id)       ON DELETE CASCADE,
  amount_owed  NUMERIC(10, 2) NOT NULL,
  percentage   NUMERIC(5, 2),
  share        NUMERIC(10, 2),
  is_settled   BOOLEAN        NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expense_splits_expense ON expense_splits (expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_user    ON expense_splits (user_id);

-- ---------- RECEIPT ITEM ASSIGNMENTS ----------
CREATE TABLE IF NOT EXISTS receipt_item_assignments (
  assignment_id SERIAL       PRIMARY KEY,
  item_id       INT          NOT NULL REFERENCES receipt_items(item_id) ON DELETE CASCADE,
  user_id       INT          NOT NULL REFERENCES users(user_id)         ON DELETE CASCADE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_item_user UNIQUE (item_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_receipt_item_assignments_item ON receipt_item_assignments (item_id);
CREATE INDEX IF NOT EXISTS idx_receipt_item_assignments_user ON receipt_item_assignments (user_id);
