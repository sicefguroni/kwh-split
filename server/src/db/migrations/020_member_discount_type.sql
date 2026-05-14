ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS discount_type VARCHAR(50) NOT NULL DEFAULT 'none';

ALTER TABLE group_members
  ADD CONSTRAINT chk_member_discount_type CHECK (discount_type IN ('none', 'pwd', 'senior'));
