-- Social OAuth support for Google/Facebook login

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN;

CREATE TABLE IF NOT EXISTS user_auth_providers (
  auth_provider_id  SERIAL       PRIMARY KEY,
  user_id           INT          NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  provider          VARCHAR(30)  NOT NULL,
  provider_user_id  VARCHAR(255) NOT NULL,
  provider_email    VARCHAR(255),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_user_auth_provider_name
    CHECK (provider IN ('google')),
  CONSTRAINT uniq_user_auth_provider_identity
    UNIQUE (provider, provider_user_id),
  CONSTRAINT uniq_user_auth_provider_user
    UNIQUE (provider, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_auth_providers_user_id
  ON user_auth_providers (user_id);
