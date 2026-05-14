-- Add 'left' invitation status for tracking when accepted members later leave.

ALTER TABLE group_invitations
  DROP CONSTRAINT IF EXISTS chk_invitation_status;

ALTER TABLE group_invitations
  ADD CONSTRAINT chk_invitation_status CHECK (
    status IN ('pending', 'accepted', 'declined', 'expired', 'left')
  );
