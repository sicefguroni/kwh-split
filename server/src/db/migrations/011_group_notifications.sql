-- Split: group invite notifications
-- Stores user-to-user invite activity notifications for accept and decline events.

CREATE TABLE IF NOT EXISTS group_notifications (
  notification_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  actor_user_id INT REFERENCES users(user_id) ON DELETE SET NULL,
  group_id INT REFERENCES groups(group_id) ON DELETE CASCADE,
  invitation_id INT REFERENCES group_invitations(invitation_id) ON DELETE SET NULL,
  type VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_group_notification_type CHECK (
    type IN ('group_invitation_accepted', 'group_invitation_declined')
  )
);

CREATE INDEX IF NOT EXISTS idx_group_notifications_user_created_at
  ON group_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_group_notifications_user_is_read
  ON group_notifications (user_id, is_read);
