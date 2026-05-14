-- Add member_joined notification type for when users join via invite link or accept an invitation.

ALTER TABLE group_notifications
  DROP CONSTRAINT IF EXISTS chk_group_notification_type;

ALTER TABLE group_notifications
  ADD CONSTRAINT chk_group_notification_type CHECK (
    type IN (
      'group_invitation_accepted', 'group_invitation_declined',
      'group_deleted', 'member_left', 'admin_transferred',
      'member_joined'
    )
  );
