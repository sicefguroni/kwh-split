#!/usr/bin/env bash
# Bootstrap the local Postgres role and database for Split.
# Usage: sudo -u postgres ./scripts/setup-db.sh

set -euo pipefail

DB_USER="${DB_USER:-split}"
DB_PASSWORD="${DB_PASSWORD:-split}"
DB_NAME="${DB_NAME:-split_dev}"

echo "-> Creating role '${DB_USER}' (if missing)"
psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;
SQL

echo "-> Creating database '${DB_NAME}' (if missing)"
if ! psql -tAc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1; then
  psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
fi

echo "-> Granting privileges"
psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" <<SQL
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
GRANT ALL ON SCHEMA public TO ${DB_USER};
SQL

echo "Done. DATABASE_URL=postgres://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"
