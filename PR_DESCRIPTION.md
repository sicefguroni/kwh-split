# feat: Google OAuth sign-in (remove Facebook)

## Summary

This PR adds end-to-end Google OAuth sign-in on top of the existing cookie/JWT auth flow, removes Facebook OAuth support, and updates auth UI, database schema, tests, and developer docs to match the Google-only flow.

## Why

- Enable social login with Google while preserving the current backend-issued auth cookies and session model.
- Support automatic account linking by email for smoother onboarding.
- Keep auth surface area focused by removing Facebook integration.

## What changed

### Backend auth and OAuth flow

- Added Google OAuth endpoints:
  - `GET /api/auth/google/start`
  - `GET /api/auth/google/callback`
- Implemented OAuth state signing/verification and callback handling with normalized redirect codes.
- Added Google token exchange + ID token validation and account provisioning/linking logic.
- Reused existing auth cookie issuance (`split_at`, `split_rt`) after successful OAuth login.
- Removed Facebook routes and provider handling.

Files:
- `server/src/modules/auth/auth.routes.ts`
- `server/src/modules/auth/auth.controller.ts`
- `server/src/modules/auth/auth.service.ts`
- `server/src/modules/auth/auth.repository.ts`
- `server/src/config/env.ts`

### Database changes

- Added migration `server/src/db/migrations/003_social_auth.sql`:
  - `users`: adds `avatar_url`, `email_verified`
  - `user_auth_providers`: provider identity link table with uniqueness constraints
  - provider check constraint now Google-only

### Frontend auth UX

- Added social auth button component with Google branding/icon.
- Integrated social auth entry in both login and signup forms.
- Added OAuth callback page and route (`/oauth/callback`) for success/error handling.
- OAuth error mapping now reflects Google-only flow.

Files:
- `client/src/components/auth/social-auth-buttons.tsx`
- `client/src/components/auth/login-form.tsx`
- `client/src/components/auth/signup-form.tsx`
- `client/src/pages/oauth-callback.tsx`
- `client/src/pages/oauth-callback.utils.ts`
- `client/src/App.tsx`

### Tests and tooling

- Added/updated server and client tests for OAuth helpers and social auth behavior.
- Added client test setup via Vitest + Testing Library.

Files:
- `server/src/modules/auth/auth.service.test.ts`
- `client/src/components/auth/social-auth-buttons.test.tsx`
- `client/src/pages/oauth-callback.utils.test.ts`
- `client/src/test/setup.ts`
- `client/vite.config.ts`
- `client/tsconfig.app.json`
- `client/package.json`
- `server/package.json`
- `pnpm-lock.yaml`

### Docs and env updates

- Added Google OAuth env/docs updates and removed Facebook requirements.

Files:
- `server/.env.example`
- `DEV_RUN.md`
- `DATABASE_SETUP.md`

## Environment variables

Required for Google OAuth:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `OAUTH_CALLBACK_BASE_URL` (e.g. `http://localhost:4000`)
- `WEB_ORIGIN` (e.g. `http://localhost:5173`)

## Test plan

- `pnpm -r run typecheck`
- `pnpm --filter @split/server test`
- `pnpm --filter @split/client test`
- Manual:
  - Click **Continue with Google** on login/signup
  - Complete consent/account chooser
  - Confirm redirect to dashboard on success
  - Confirm friendly error handling on callback failures

## Notes

- Migration `003_social_auth.sql` must be applied before OAuth login works (`42P01` otherwise).
- Suggested PR title: **`feat(auth): add Google OAuth sign-in and remove Facebook`**
