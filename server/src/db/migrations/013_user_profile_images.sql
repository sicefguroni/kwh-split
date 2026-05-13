-- Split: User Profile Images
-- Add profile picture and bank/wallet QR code fields to users table

ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS profile_image_url TEXT,
  ADD COLUMN IF NOT EXISTS bank_qr_url TEXT;
