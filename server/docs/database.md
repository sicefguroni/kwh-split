# Split - Database

PostgreSQL schema for the group expense tracker. Managed through the
migration runner at `server/src/db/migrate.ts`.

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

Column on `expenses`: **`client_expense_uuid`** (nullable UUID, unique when set) — idempotent key for authenticated `/api/sync` upserts (see [`offline-sync.routes.ts`](../src/modules/offline-sync/offline-sync.routes.ts)); requires group membership and optional env `OFFLINE_SYNC_DEFAULT_GROUP_ID`.

> Note: the previous reference schema used `expensers` and
> `receipt_items_assignments`. These were renamed to `expenses` and
> `receipt_item_assignments` for grammatical clarity. If you need to import
> existing data, rename the tables in your dump first.

All foreign keys use `ON DELETE CASCADE`. Monetary amounts use
`NUMERIC(10, 2)`. Timestamps are `TIMESTAMPTZ` and default to
`CURRENT_TIMESTAMP`.

## Running migrations

Migrations live in `server/src/db/migrations/` as numbered `.sql` files.
The runner tracks applied migrations in a `schema_migrations` table and
applies pending files in lexical order, each inside a transaction.

```bash
# From the repo root:
pnpm db:migrate
```

Production image (after `pnpm --filter @split/server run build` / Docker): the same runner includes `dist/db/migrations/*.sql` and you can run:

```bash
DATABASE_URL="postgres://..." node dist/db/migrate.js
# or: pnpm --filter @split/server run db:migrate:prod
```

## Migrations on AWS RDS (private subnet)

Terraform puts RDS in **private subnets** with a security group that only allows **Postgres from the ECS task security group**. Your laptop cannot reach RDS until you either open the SG briefly or run migrations from ECS.

### Option A — Temporary “your IP” rule (simplest)

**Shell note:** examples below use **bash / zsh** (`VAR=$(cmd)`, `export`). In **fish**, use `set VAR (cmd)` and `set -gx VAR value` instead of `export`.

**New `output` values:** `terraform output ...` only works for outputs already stored in state. If you see **“Output … not found”** after adding outputs to `.tf` files, run **`terraform apply`** once from `infra/terraform/` (often no infrastructure changes), **or** use the **`terraform console`** lines below—they read live resource attributes from state and work immediately.

1. **Get values from Terraform** (from `infra/terraform/`):

   ```bash
   terraform output -raw rds_endpoint
   # If that fails:
   # printf 'aws_db_instance.postgres.address\n' | terraform console | tr -d '"\r\n'
   ```

2. **Your public IP** (must be the same path the Internet sees, e.g. no VPN surprise):

   ```bash
   curl -sSf https://checkip.amazonaws.com
   ```

3. **Allow inbound 5432 from your IP** (keep `/32`). **`SG_ID`** uses `terraform console` so it works even before `terraform output rds_security_group_id` exists in state:

   **bash / zsh**

   ```bash
   SG_ID="$(printf 'aws_security_group.rds.id\n' | terraform console | tr -d '"\r\n')"
   MYIP="$(curl -sSf https://checkip.amazonaws.com)"
   aws ec2 authorize-security-group-ingress \
     --group-id "$SG_ID" \
     --protocol tcp \
     --port 5432 \
     --cidr "${MYIP}/32"
   ```

   **fish**

   ```fish
   set SG_ID (printf 'aws_security_group.rds.id\n' | terraform console | string replace -a '"' '' | string trim)
   set MYIP (curl -sSf https://checkip.amazonaws.com)
   aws ec2 authorize-security-group-ingress \
     --group-id $SG_ID \
     --protocol tcp \
     --port 5432 \
     --cidr "$MYIP/32"
   ```

4. **Build URL and migrate** from the **repo root**. DB name and user are `split` (see `infra/terraform/main.tf`). **URL-encode** the password if it contains `@`, `#`, `/`, spaces, etc. (otherwise the URL parser breaks).

   **Easier for complex passwords:** omit `DATABASE_URL` and set `DATABASE_HOST`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` (`split` on RDS), `DATABASE_PORT` — the app builds a safe connection string (or leave a bad `DATABASE_URL` in place **and** set `DATABASE_HOST`; the pool will ignore the URI and use the `DATABASE_*` fields).

   **bash / zsh**

   ```bash
   export DATABASE_URL='postgres://split:URL_ENCODED_PASSWORD@RDS_HOST:5432/split'
   pnpm db:migrate
   ```

   **fish**

   ```fish
   set -gx DATABASE_URL 'postgres://split:URL_ENCODED_PASSWORD@RDS_HOST:5432/split'
   pnpm db:migrate
   ```

5. **Remove the rule** when done (use rule IDs from the authorize output, or EC2 console → security group → inbound rules):

   **bash / zsh**

   ```bash
   aws ec2 revoke-security-group-ingress \
     --group-id "$SG_ID" \
     --protocol tcp \
     --port 5432 \
     --cidr "${MYIP}/32"
   ```

   **fish**

   ```fish
   aws ec2 revoke-security-group-ingress \
     --group-id $SG_ID \
     --protocol tcp \
     --port 5432 \
     --cidr "$MYIP/32"
   ```

### Option B — One-off ECS Fargate task (no public RDS exposure)

Use this when you do **not** want to open RDS to the Internet. Requires an **API** task definition that already uses your **pushed ECR image** (the Dockerfile copies `server/src/db/migrations` into `dist/db/migrations`).

1. From `infra/terraform/` (values from **`terraform console`** so this works even if newer `output` blocks are not in state yet):

   **bash / zsh**

   ```bash
   CLUSTER="$(printf 'aws_ecs_cluster.main.name\n' | terraform console | tr -d '"\r\n')"
   SUBNETS="$(printf 'join(",", aws_subnet.public[*].id)\n' | terraform console | tr -d '"\r\n')"
   SG="$(printf 'aws_security_group.ecs.id\n' | terraform console | tr -d '"\r\n')"
   ```

   **fish**

   ```fish
   set CLUSTER (printf 'aws_ecs_cluster.main.name\n' | terraform console | string replace -a '"' '' | string trim)
   set SUBNETS (printf 'join(",", aws_subnet.public[*].id)\n' | terraform console | string replace -a '"' '' | string trim)
   set SG (printf 'aws_security_group.ecs.id\n' | terraform console | string replace -a '"' '' | string trim)
   ```

2. Register a one-off task or reuse the latest **API** task definition revision from the console / `aws ecs describe-task-definition --task-definition …`.

3. **Run** (replace `TASK_DEF_ARN` with the family or full ARN of your **API** task definition, and `api` with that task’s **container name**):

   **bash / zsh**

   ```bash
   CONTAINER="api"   # or whatever name is in the task definition JSON
   aws ecs run-task \
     --cluster "$CLUSTER" \
     --launch-type FARGATE \
     --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SG],assignPublicIp=ENABLED}" \
     --task-definition "$TASK_DEF_ARN" \
     --overrides "$(jq -n \
       --arg url 'postgres://split:PASSWORD@HOST:5432/split' \
       --arg name "$CONTAINER" \
       '{containerOverrides:[{name:$name,command:["node","dist/db/migrate.js"],environment:[{name:"DATABASE_URL",value:$url}]}]}')"
   ```

   **fish**

   ```fish
   set CONTAINER api   # or whatever name is in the task definition JSON
   aws ecs run-task \
     --cluster $CLUSTER \
     --launch-type FARGATE \
     --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SG],assignPublicIp=ENABLED}" \
     --task-definition "$TASK_DEF_ARN" \
     --overrides (jq -n \
       --arg url 'postgres://split:PASSWORD@HOST:5432/split' \
       --arg name $CONTAINER \
       '{containerOverrides:[{name:$name,command:["node","dist/db/migrate.js"],environment:[{name:"DATABASE_URL",value:$url}]}]}')
   ```

4. Watch exit code: **CloudWatch** log stream for that task, or `aws ecs describe-tasks` until `lastStatus` is `STOPPED` and check `stoppedReason` / container exit code.

Use **Secrets Manager** or **ECS secrets** for `DATABASE_URL` in real workflows instead of inline passwords in shell history.

## Bootstrapping a fresh local database

Create a Postgres database and role (or use your host’s usual workflow), then:

```bash
cp server/.env.example server/.env   # set JWT_SECRET + DATABASE_URL
pnpm db:migrate
```

See [`DATABASE_SETUP.md`](../../DATABASE_SETUP.md) at the repo root for broader schema notes.

## Authoring a new migration

1. Create a new file in `server/src/db/migrations/` with the next numeric
   prefix, for example `004_invitations.sql`.
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
