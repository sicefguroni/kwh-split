-- KWH-Split Database Schema
-- PostgreSQL schema for expense splitting application
-- This file is the base schema. Apply `pnpm db:migrate` after loading it so later
-- feature migrations stay in sync with the server code.

-- Create USERS table
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create GROUPS table
CREATE TABLE groups (
    group_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    currency VARCHAR(10) DEFAULT 'USD',
    image_url TEXT,
    invite_token VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create GROUP_MEMBERS table (junction table)
CREATE TABLE group_members (
    member_id SERIAL PRIMARY KEY,
    group_id INT NOT NULL,
    user_id INT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_group_members_group FOREIGN KEY (group_id) REFERENCES groups(group_id) ON DELETE CASCADE,
    CONSTRAINT fk_group_members_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT unique_group_user UNIQUE(group_id, user_id)
);

-- Create GROUP_INVITATIONS table
CREATE TABLE group_invitations (
    invitation_id SERIAL PRIMARY KEY,
    group_id INT NOT NULL,
    inviter_user_id INT NOT NULL,
    invitee_email VARCHAR(255) NOT NULL,
    invitee_user_id INT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, accepted, declined, expired
    invite_token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_group_invitations_group FOREIGN KEY (group_id) REFERENCES groups(group_id) ON DELETE CASCADE,
    CONSTRAINT fk_group_invitations_inviter FOREIGN KEY (inviter_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_group_invitations_invitee FOREIGN KEY (invitee_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT chk_invitation_status CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'left'))
);

CREATE TABLE group_notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    actor_user_id INT,
    group_id INT,
    invitation_id INT,
    type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_group_notifications_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_group_notifications_actor FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_group_notifications_group FOREIGN KEY (group_id) REFERENCES groups(group_id) ON DELETE CASCADE,
    CONSTRAINT fk_group_notifications_invitation FOREIGN KEY (invitation_id) REFERENCES group_invitations(invitation_id) ON DELETE SET NULL,
    CONSTRAINT chk_group_notification_type CHECK (type IN ('group_invitation_accepted', 'group_invitation_declined', 'group_deleted', 'member_left', 'admin_transferred', 'member_joined', 'expense_added', 'expense_deleted', 'settlement_paid'))
);

-- Create EXPENSES table
CREATE TABLE expenses (
    expense_id SERIAL PRIMARY KEY,
    group_id INT NOT NULL,
    title_description VARCHAR(255) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    sale_date DATE NOT NULL,
    tax_amount DECIMAL(10, 2) DEFAULT 0.00,
    tip_amount DECIMAL(10, 2) DEFAULT 0.00,
    split_type VARCHAR(50) DEFAULT 'equal',
    receipt_items_flag BOOLEAN DEFAULT false,
    receipt_image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_expenses_group FOREIGN KEY (group_id) REFERENCES groups(group_id) ON DELETE CASCADE
);

-- Create RECEIPT_ITEMS table
CREATE TABLE receipt_items (
    item_id SERIAL PRIMARY KEY,
    expense_id INT NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_receipt_items_expense FOREIGN KEY (expense_id) REFERENCES expenses(expense_id) ON DELETE CASCADE
);

-- Create EXPENSE_SPLITS table
CREATE TABLE expense_splits (
    split_id SERIAL PRIMARY KEY,
    expense_id INT NOT NULL,
    user_id INT NOT NULL,
    amount_owed DECIMAL(10, 2) NOT NULL,
    percentage DECIMAL(5, 2),
    share DECIMAL(10, 2),
    is_settled BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_expense_splits_expense FOREIGN KEY (expense_id) REFERENCES expenses(expense_id) ON DELETE CASCADE,
    CONSTRAINT fk_expense_splits_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Create RECEIPT_ITEM_ASSIGNMENTS table
CREATE TABLE receipt_item_assignments (
    assignment_id SERIAL PRIMARY KEY,
    item_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_assignments_item FOREIGN KEY (item_id) REFERENCES receipt_items(item_id) ON DELETE CASCADE,
    CONSTRAINT fk_assignments_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT unique_item_user UNIQUE(item_id, user_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_expenses_group ON expenses(group_id);
CREATE INDEX idx_receipt_items_expense ON receipt_items(expense_id);
CREATE INDEX idx_expense_splits_expense ON expense_splits(expense_id);
CREATE INDEX idx_expense_splits_user ON expense_splits(user_id);
CREATE INDEX idx_receipt_item_assignments_item ON receipt_item_assignments(item_id);
CREATE INDEX idx_receipt_item_assignments_user ON receipt_item_assignments(user_id);
CREATE INDEX idx_groups_invite_token ON groups(invite_token);
CREATE INDEX idx_group_invitations_group ON group_invitations(group_id);
CREATE INDEX idx_group_invitations_invitee_email ON group_invitations(invitee_email);
CREATE INDEX idx_group_invitations_token ON group_invitations(invite_token);
CREATE INDEX idx_group_invitations_status ON group_invitations(status);
CREATE INDEX idx_group_invitations_inviter_created_at ON group_invitations(inviter_user_id, created_at DESC);
CREATE INDEX idx_group_invitations_invitee_user_status ON group_invitations(invitee_user_id, status);
CREATE INDEX idx_group_invitations_invitee_email_status ON group_invitations((LOWER(invitee_email)), status);
CREATE INDEX idx_group_notifications_user_created_at ON group_notifications(user_id, created_at DESC);
CREATE INDEX idx_group_notifications_user_is_read ON group_notifications(user_id, is_read);
