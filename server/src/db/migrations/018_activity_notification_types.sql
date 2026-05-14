-- Add expense and settlement notification types for group activity feed.

ALTER TABLE group_notifications
  DROP CONSTRAINT IF EXISTS chk_group_notification_type;

ALTER TABLE group_notifications
  ADD CONSTRAINT chk_group_notification_type CHECK (
    type IN (
      'group_invitation_accepted', 'group_invitation_declined',
      'group_deleted', 'member_left', 'admin_transferred',
      'member_joined', 'expense_added', 'expense_deleted',
      'settlement_paid'
    )
  );
