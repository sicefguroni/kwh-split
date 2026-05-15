# Terraform (AWS) — kwh-split

Prerequisites: AWS CLI configured, `terraform` >= 1.5.

### AWS credentials for Terraform

The AWS provider reads the **same credential chain** as the AWS CLI (env vars, shared `~/.aws/credentials`, SSO profile, etc.). If you see **“No valid credential sources found”** or **EC2 IMDS / GetMetadata … deadline exceeded**, Terraform tried the EC2 instance role because nothing else was configured—typical on a laptop.

Fix (pick one):

1. **Long-lived keys** (local dev only): `aws configure` and set access key + secret for the right account/region.
2. **Named profile**: `export AWS_PROFILE=your-profile` then run `terraform plan` in the same shell.
3. **IAM Identity Center (SSO)**: `aws sso login --profile your-profile` then `export AWS_PROFILE=your-profile`.
4. **`aws login` (AWS CLI 2.32+)** / console credentials: Terraform 1.14’s S3 backend can authenticate with **LoginProvider**, but the **hashicorp/aws provider must be ≥ 6.23.0** to use the same cache. This repo pins that range in [`versions.tf`](terraform/versions.tf). After pulling, run `terraform init -upgrade` under `infra/terraform/`. If the backend works and only `terraform plan` fails with IMDS, an outdated provider lock is the usual cause.

Verify before `terraform plan` (must be the **same shell** you use for `terraform`):

```bash
aws sts get-caller-identity
```

### If `aws sts get-caller-identity` works but Terraform still says “no valid credentials”

1. **You used `--profile` on the CLI but did not export it**  
   Example: `aws sts get-caller-identity --profile split` works, but Terraform does **not** see `--profile`. Fix:
   ```bash
   export AWS_PROFILE=split
   terraform plan
   ```
   Or one line: `AWS_PROFILE=split terraform plan`

2. **Terraform runs in a different environment than the CLI**  
   e.g. a GUI “Terraform Plan” button, another terminal tab, or a task runner that does not load your shell rc file. Run `terraform plan` from the **same** terminal where `echo $AWS_PROFILE` shows the right value.

3. **SSO / profile only in `~/.aws/config` (no static keys)**  
   Try:
   ```bash
   export AWS_SDK_LOAD_CONFIG=1
   export AWS_PROFILE=your-profile
   aws sso login --profile your-profile   # if needed
   terraform plan
   ```

4. **Stale init / wrong backend cache** (less common)  
   From `infra/terraform/`:
   ```bash
   export AWS_PROFILE=your-profile
   terraform init -reconfigure
   terraform plan
   ```

5. **Debug**  
   ```bash
   env | grep '^AWS_'
   TF_LOG=INFO terraform plan
   ```
   Confirm Terraform sees `AWS_PROFILE` (and no empty `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` overriding the chain).

6. **Pin the profile in `terraform.tfvars` (recommended when the IDE strips env)**  
   The AWS provider accepts an explicit `aws_profile` variable (see [`terraform.tfvars.example`](terraform/terraform.tfvars.example)). In your **local** `terraform.tfvars`:
   ```hcl
   aws_profile = "split"   # same name as in `aws configure list-profiles`
   ```
   That forces the provider to load that profile from `~/.aws/config` / `~/.aws/credentials` even when `AWS_PROFILE` is unset in the Terraform process.

7. **S3 remote backend uses its own config**  
   If `terraform init` or state access fails with the same symptom, pass the profile at init time (one-time or whenever you change it):
   ```bash
   cd infra/terraform
   terraform init -reconfigure -backend-config="profile=split"
   ```
   Replace `split` with your profile name.

Remote state is configured in [`versions.tf`](terraform/versions.tf): **S3** bucket `split-terraform-646385694637-ap-southeast-1-an`, object key `split/terraform.tfstate`, **DynamoDB** table `terraform-locks-split`, region `ap-southeast-1`. Ensure that bucket and table already exist and your IAM principal can read/write them before `terraform init`.

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # edit secrets / region
terraform init          # use terraform init -migrate-state if moving from local state
terraform plan
terraform apply
```

This stack provisions a **VPC** (public + private subnets), **RDS PostgreSQL** (single-AZ micro for cost), **ElastiCache Redis**, **ECR** repositories, **ECS Fargate** (API + notification worker), **ALB** HTTP :80, **EventBridge + Lambda** stub for scheduled jobs, **CloudWatch** log groups, and baseline **IAM**.

## Deploy API + worker (after DB migrations)

1. **Build and push** both images (repo root; same tag as `api_image_tag` / `worker_image_tag` in `terraform.tfvars`):

   ```bash
   AWS_REGION=ap-southeast-1
   ECR_API=$(cd infra/terraform && terraform output -raw ecr_api_repository_url)
   ECR_WORKER=$(cd infra/terraform && terraform output -raw ecr_worker_repository_url)
   TAG=migrate   # or latest

   aws ecr get-login-password --region "$AWS_REGION" | \
     docker login --username AWS --password-stdin "${ECR_API%%/*}"

   docker build --target api -t split-api:"$TAG" .
   docker tag split-api:"$TAG" "$ECR_API:$TAG"
   docker push "$ECR_API:$TAG"

   docker build --target worker -t split-worker:"$TAG" .
   docker tag split-worker:"$TAG" "$ECR_WORKER:$TAG"
   docker push "$ECR_WORKER:$TAG"
   ```

2. **Set `terraform.tfvars`**: `db_password` (must match RDS), `jwt_secret` (≥32 chars), `api_image_tag` / `worker_image_tag` = the tag you pushed.

3. **Apply** (updates ECS task definitions, ALB health check `/api/health`, services):

   ```bash
   cd infra/terraform
   terraform apply
   ```

4. **Smoke test**:

   ```bash
   terraform output -raw api_health_url
   curl -sS "$(terraform output -raw api_health_url)"
   ```

   ECS → cluster → service → **Tasks** should be **RUNNING** and target group **healthy**. Logs: `/ecs/kwh-split-dev/api` and `.../worker`.

Production hardening: ACM + HTTPS listener, NAT or VPC endpoints for private ECS, Aurora upgrade path, WAF, Secrets Manager wiring for task defs (currently use variables), and CloudFront + S3 for the Vite SPA (see plan).

## Public site (CloudFront + S3)

With `enable_public_site = true` (default), Terraform creates:

- Private **S3** bucket for `client/dist`
- **CloudFront** `https://….cloudfront.net` — default behavior → S3, `/api/*` → ALB (cookies forwarded, no API cache)
- ECS **`WEB_ORIGIN`** / **`OAUTH_CALLBACK_BASE_URL`** / **`COOKIE_SECURE=true`** updated to the CloudFront URL

**1. Apply infra** (creates CDN; bucket empty until deploy):

```bash
cd infra/terraform
terraform apply
```

**2. Build + upload + invalidate:**

```bash
# from repo root; needs AWS_PROFILE / credentials for S3 + CloudFront
pnpm deploy:site
```

**3. Open the site:**

```bash
terraform -chdir=infra/terraform output -raw site_url
```

**4. Google OAuth** (if used):

- In `terraform.tfvars`: set `google_client_id` and `google_client_secret` (same as local `server/.env`), then `terraform apply` so ECS gets them.
- Google Cloud Console → **Web application** client:
  - **Authorized JavaScript origins:** `https://<cloudfront-domain>` (no trailing slash)
  - **Authorized redirect URIs:** `https://<cloudfront-domain>/api/auth/google/callback`
- Must match ECS `OAUTH_CALLBACK_BASE_URL` (Terraform sets this to the CloudFront URL when `enable_public_site = true`).

### OCR + SMTP (group invites / receipt scan)

Copy from local `server/.env` into `terraform.tfvars`:

- `ocr_api_key` — [TabScanner](https://tabscanner.com) API key
- `smtp_host`, `smtp_port` (587 or 465), `smtp_user`, `smtp_pass`, `smtp_from` — invitation emails

Then `terraform apply` (updates API task env). ECS tasks need outbound HTTPS (TabScanner) and SMTP (e.g. Gmail, SendGrid, SES SMTP).

### Realtime (WebSockets)

The client connects to `wss://<your-cloudfront-domain>/api/realtime` (same origin as the SPA). Terraform configures CloudFront → ALB with **HTTP/1.1** targets, long **ALB idle timeout**, and **`AllViewerExceptHostHeader`** (required for WebSocket through CloudFront to ALB). **Redis** must be set (`REDIS_URL` on API) for cross-task fan-out; the API also broadcasts to local sockets immediately.

After changing `cloudfront.tf` or ALB settings, run `terraform apply` and wait for the distribution to deploy (~5–15 min).

**Custom domain later:** ACM cert in **us-east-1**, attach to CloudFront, set `aliases` + `viewer_certificate` in `cloudfront.tf`, update Google OAuth URLs.

