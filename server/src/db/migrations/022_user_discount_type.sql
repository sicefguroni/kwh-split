ALTER TABLE users
  ADD COLUMN IF NOT EXISTS discount_type VARCHAR(50) NOT NULL DEFAULT 'none';

ALTER TABLE users
  ADD CONSTRAINT chk_user_discount_type CHECK (discount_type IN ('none', 'pwd', 'senior'));
