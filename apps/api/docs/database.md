# Split - Database

PostgreSQL schema for the group expense tracker. Managed through the
migration runner at `apps/api/src/db/migrate.ts`.

## Schema overview

| Table                      | Purpose                                                |
| -------------------------- | ------------------------------------------------------ |
| `users`                    | Account information (auth + profile)                   |
| `groups`                   | A spending group (roommates, trip, etc.)               |
| `group_members`            | Many-to-many link between users and groups, with role  |
| `expenses`                 | A single expense recorded against a group              |
| `receipt_items`            | Optional itemised lines from a receipt                 |
| `receipt_item_assignments` | Maps receipt items to users who owe them               |
| `expense_splits`           | How an expense is split between group members          |

> Note: the previous reference schema used `expensers` and
> `receipt_items_assignments`. These were renamed to `expenses` and
> `receipt_item_assignments` for grammatical clarity. If you need to import
> existing data, rename the tables in your dump first.

All foreign keys use `ON DELETE CASCADE`. Monetary amounts use
`NUMERIC(10, 2)`. Timestamps are `TIMESTAMPTZ` and default to
`CURRENT_TIMESTAMP`.

## Running migrations

Migrations live in `apps/api/src/db/migrations/` as numbered `.sql` files.
The runner tracks applied migrations in a `schema_migrations` table and
applies pending files in lexical order, each inside a transaction.

```bash
# From the repo root:
pnpm db:migrate
```

## Bootstrapping a fresh local database

```bash
sudo -u postgres ./scripts/setup-db.sh   # creates role + db
cp apps/api/.env.example apps/api/.env   # set JWT_SECRET + DATABASE_URL
pnpm db:migrate
```

## Authoring a new migration

1. Create a new file in `apps/api/src/db/migrations/` with the next numeric
   prefix, for example `002_invitations.sql`.
2. Prefer `IF NOT EXISTS` / `IF EXISTS` so re-runs are harmless during
   development.
3. Keep each migration focused on a single cohesive change; do not edit an
   already-applied migration - add another one instead.
4. Run `pnpm db:migrate` to apply it.

## Handy queries

### Members of a group

```sql
SELECT u.name, gm.role
FROM group_members gm
JOIN users u ON u.user_id = gm.user_id
WHERE gm.group_id = $1;
```

### Total expenses for a group

```sql
SELECT COALESCE(SUM(total_amount), 0) AS total
FROM expenses
WHERE group_id = $1;
```

### Outstanding balance for a user

```sql
SELECT COALESCE(SUM(amount_owed), 0) AS total_owed
FROM expense_splits
WHERE user_id = $1 AND is_settled = FALSE;
```
