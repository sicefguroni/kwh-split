-- Soft-delete group members to preserve historical expense/settlement data.

ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_group_members_active
  ON group_members (group_id, is_active);
