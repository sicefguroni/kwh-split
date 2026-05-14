-- Add member_left and admin_transferred notification types for leave/transfer events.

ALTER TABLE group_notifications
  DROP CONSTRAINT IF EXISTS chk_group_notification_type;

ALTER TABLE group_notifications
  ADD CONSTRAINT chk_group_notification_type CHECK (
    type IN (
      'group_invitation_accepted', 'group_invitation_declined',
      'group_deleted', 'member_left', 'admin_transferred'
    )
  );
