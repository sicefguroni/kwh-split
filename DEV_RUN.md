# Running the app (development)

> This file describes how to run the backend, prepare the database, and start the frontend. Commands shown are for PowerShell (Windows). For macOS/Linux replace PowerShell environment lines with `export VAR=...` and run commands in a shell.

## Prerequisites

- Node.js >= 20 and `pnpm` installed
- PostgreSQL 12+ with `psql` available
- From repo root: the repo workspace has `server`, `client`, and `apps/api` (see `package.json`)

## 1) Install dependencies

From the repository root:

```powershell
pnpm install
```

## 2) Database setup

Create the database and load the SQL schema (PowerShell):

```powershell
# set DB password for non-interactive psql
$env:PGPASSWORD='your_db_password'
# create DB (or use createdb kwh_split)
psql -U postgres -h localhost -c "CREATE DATABASE kwh_split"
# load schema.sql
psql -U postgres -h localhost -d kwh_split -f schema.sql
```

If you prefer, open `psql` and run `\i schema.sql` inside the `kwh_split` database.

See [DATABASE_SETUP.md](DATABASE_SETUP.md) for more details.

## 3) Environment variables

Create (or update) `server/.env`. Minimal values:

- `JWT_SECRET` — generate a strong secret (example below)
- `DATABASE_URL` — connection string for Postgres (e.g. `postgres://postgres:password@localhost:5432/kwh_split`)
- `PORT` — API port (default 4000)
- `WEB_ORIGIN` — client origin (default `http://localhost:5173`)

Example `.env` (do NOT commit):

```
JWT_SECRET=<your-generated-secret>
DATABASE_URL=postgres://postgres:your_db_password@localhost:5432/kwh_split
PORT=4000
WEB_ORIGIN=http://localhost:5173
```

Generate a secure secret (Node):

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Write that into `server/.env` or set `JWT_SECRET` in the shell before starting the server.

## 4) Run DB migrations (optional)

The repo provides a migration runner. From the repo root you can run:

```powershell
# ensure env vars are visible to the command
$env:DATABASE_URL='postgres://postgres:your_db_password@localhost:5432/kwh_split'
$env:JWT_SECRET='<your-secret>'
pnpm --filter @split/api run db:migrate
```

Or run the same from the package folder if needed.

## 5) Start services

You can start services individually or use the root `dev` script which runs package dev scripts in parallel.

Start backend (server):

```powershell
Push-Location server
$env:DATABASE_URL='postgres://postgres:your_db_password@localhost:5432/kwh_split'
$env:JWT_SECRET='<your-secret>'
pnpm run dev
Pop-Location
```

Start client (vite):

```powershell
Push-Location client
pnpm run dev
Pop-Location
```

Start both via root (runs all `dev` scripts in workspace):

```powershell
pnpm run dev
```

Notes:
- API default port is `4000`. The client is Vite on `5173` (may auto-pick another port if 5173 is in use).
- If you run the root `pnpm run dev` and a service is already running on the same port, you'll get errors or the process may pick a different port (client).

## 6) Troubleshooting

- Vite proxy errors `ECONNREFUSED /api/...` or browser console saying 401/Unauthorized:
  - Verify the backend is running (should listen on `http://localhost:4000`).
  - Restart the backend and check logs for errors.
  - Ensure `DATABASE_URL` and `JWT_SECRET` match the values the backend is using.
  - If you see 401 responses, clear auth cookies/localStorage in the browser and re-login.

- To check port availability (PowerShell):

```powershell
Test-NetConnection -ComputerName localhost -Port 4000
Get-NetTCPConnection -LocalPort 4000
```

- If migrations fail because the schema already exists, the migration runner records applied files in `schema_migrations`. You can insert the migration name manually or inspect the SQL in `apps/api/src/db/migrations`.

## Helpful files

- `server/.env` — environment file for the API ([server/.env](server/.env))
- `DATABASE_SETUP.md` — database-specific instructions ([DATABASE_SETUP.md](DATABASE_SETUP.md))
- Root `package.json` — workspace scripts ([package.json](package.json#L1))
- Server package: [server/package.json](server/package.json#L1)
- Client package: [client/package.json](client/package.json#L1)

---

If you want, I can also add a `scripts` shortcut or start both servers now. Otherwise run `pnpm run dev` at the root when you're ready.
