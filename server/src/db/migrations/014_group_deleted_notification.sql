-- Allow 'group_deleted' as a notification type so members are notified when
-- an admin deletes a group they belonged to.

ALTER TABLE group_notifications
  DROP CONSTRAINT IF EXISTS chk_group_notification_type;

ALTER TABLE group_notifications
  ADD CONSTRAINT chk_group_notification_type CHECK (
    type IN ('group_invitation_accepted', 'group_invitation_declined', 'group_deleted')
  );
