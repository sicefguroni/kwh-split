-- Split: collaborator system
-- Adds group invitations and public invite links functionality

-- Add invite_token column to groups table
ALTER TABLE groups ADD COLUMN IF NOT EXISTS invite_token VARCHAR(255) UNIQUE;

-- Create GROUP_INVITATIONS table
CREATE TABLE IF NOT EXISTS group_invitations (
    invitation_id SERIAL PRIMARY KEY,
    group_id INT NOT NULL,
    inviter_user_id INT NOT NULL,
    invitee_email VARCHAR(255) NOT NULL,
    invitee_user_id INT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    invite_token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_group_invitations_group FOREIGN KEY (group_id) REFERENCES groups(group_id) ON DELETE CASCADE,
    CONSTRAINT fk_group_invitations_inviter FOREIGN KEY (inviter_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_group_invitations_invitee FOREIGN KEY (invitee_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT chk_invitation_status CHECK (status IN ('pending', 'accepted', 'declined', 'expired'))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_groups_invite_token ON groups(invite_token);
CREATE INDEX IF NOT EXISTS idx_group_invitations_group ON group_invitations(group_id);
CREATE INDEX IF NOT EXISTS idx_group_invitations_invitee_email ON group_invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_group_invitations_token ON group_invitations(invite_token);
CREATE INDEX IF NOT EXISTS idx_group_invitations_status ON group_invitations(status);