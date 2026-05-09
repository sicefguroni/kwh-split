-- Split: group media persistence and invitation lookup improvements
-- Persists group cover images and adds lookup indexes for the collaboration flow.

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS image_url TEXT;

UPDATE groups
SET invite_token = CONCAT('invite_', group_id, '_', FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint)
WHERE invite_token IS NULL;

CREATE INDEX IF NOT EXISTS idx_group_invitations_inviter_created_at
  ON group_invitations (inviter_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_group_invitations_invitee_user_status
  ON group_invitations (invitee_user_id, status);

CREATE INDEX IF NOT EXISTS idx_group_invitations_invitee_email_status
  ON group_invitations (LOWER(invitee_email), status);
