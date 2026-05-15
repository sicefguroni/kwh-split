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

## Custom domain (Route 53)

Your app stack stays in **`ap-southeast-1`**. Only the **ACM certificate for CloudFront** is created in **`us-east-1`** (AWS requirement for custom hostnames on CloudFront).

**Which path is faster?**

| Path | Typical time to **Issued** cert | Caveat |
|------|---------------------------------|--------|
| **B — validation CNAME at registrar** (Name.com, etc.) | Often **5–15 minutes** after you add the record | You must also point the **site hostname** at CloudFront in that same DNS (see below) until you delegate NS. |
| **A — delegate nameservers to Route 53** | Often **15–60+ minutes** (NS propagation) | One place for all DNS; Terraform’s Route 53 A/AAAA aliases work automatically. |

Use **B** if you want the certificate to validate first. Use **A** when you want Terraform to own all records long term.

### Quick path B — ACM validates while DNS stays at the registrar (fastest)

Use this when public NS still point at Name.com (or another host) and `aws_acm_certificate_validation` has been waiting a long time.

1. **AWS Console** → **Certificate Manager** → region **US East (N. Virginia)** → open the pending certificate for your `site_domain`.
2. Under **Domains**, copy the **CNAME name** and **CNAME value** for validation.
3. At your **registrar DNS** (Name.com: **DNS Records** for the domain), add a **CNAME** with exactly that name and value. (Some UIs want only the left-hand label before your domain; match what Name.com’s help shows for ACM-style records.)
4. Verify from your machine (replace with the validation hostname ACM shows):

   ```bash
   dig CNAME _xxxxxxxx.kwhsplit.app +short
   ```

   It should return ACM’s target. Within a few minutes ACM should show **Issued**; re-run `terraform apply` if it had failed or timed out.

5. **Site traffic on the same hostname:** Until nameservers point at Route 53, Terraform’s **A/AAAA alias** records exist only inside your Route 53 zone—the public Internet still reads Name.com. Add at Name.com whichever they support aimed at CloudFront:

   - **Subdomain** (e.g. `app`): CNAME → `xxxxxxxx.cloudfront.net` (see `terraform output -raw cloudfront_domain_name`).
   - **Apex** (`kwhsplit.app`): many registrars need **ALIAS/ANAME/flattened CNAME** to `xxxxxxxx.cloudfront.net`; check Name.com’s docs.

Later you can switch to **path A** so Route 53 (and Terraform) is authoritative and you can drop the duplicate registrar records.

### 1. Route 53 hosted zone

1. Route 53 → **Hosted zones** → **Create hosted zone** for your domain (e.g. `example.com`).
2. Copy the hosted zone **ID** (Terraform `route53_zone_id`).

### 1a. Path A — delegate nameservers at your registrar

ACM and Terraform-managed **apex** aliases only apply when **public resolvers query Route 53**. If NS still point at Name.com (`*.name.com`), validation records created only in Route 53 stay invisible unless you did **path B** above.

1. Get the four nameservers for your hosted zone:

   ```bash
   aws route53 get-hosted-zone --id YOUR_HOSTED_ZONE_ID \
     --query 'DelegationSet.NameServers' --output text
   ```

2. At the **registrar** (Name.com: **My Domains** → your domain → **Nameservers** → **custom**), replace entries with exactly those four AWS hostnames.

3. After propagation (often 15–60 minutes), confirm:

   ```bash
   dig NS yourdomain.example +short
   ```

   Expect `*.awsdns-*` hosts.

### 2. Configure Terraform

In local `terraform.tfvars` (not committed):

```hcl
site_domain     = "app.example.com"              # hostname users will open
route53_zone_id = "Z0123456789ABCDEFGHIJ"
# site_domain_aliases = ["www.example.com"]      # optional
```

### 3. Apply

```bash
cd infra/terraform
terraform init    # picks up the us-east-1 provider alias
terraform plan
terraform apply
```

Terraform will:

- Request an ACM cert in **us-east-1** and create **DNS validation** CNAMEs in your zone
- Attach the cert to CloudFront (`aliases` + HTTPS)
- Create **A/AAAA alias** records from `site_domain` (and aliases) to CloudFront
- Set ECS **`WEB_ORIGIN`** and **`OAUTH_CALLBACK_BASE_URL`** to `https://app.example.com`

Wait until ACM shows **Issued** and CloudFront status **Deployed** (often 5–20 minutes).

### 4. Google OAuth

Update the OAuth client (replace with your `site_domain`):

- **Authorized JavaScript origins:** `https://app.example.com`
- **Authorized redirect URIs:** `https://app.example.com/api/auth/google/callback`

### 5. Deploy SPA and verify

```bash
pnpm deploy:site
curl -sS "$(terraform output -raw site_url)/api/health"
```

Outputs:

- `site_url` — custom URL when `site_domain` is set, otherwise `https://….cloudfront.net`
- `cloudfront_domain_name` — default CloudFront hostname (still works during cutover)

To remove a custom domain later, clear `site_domain` / `route53_zone_id` in tfvars and `terraform apply` (CloudFront returns to the default certificate).

