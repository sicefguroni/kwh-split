#!/usr/bin/env bash
# Build the Vite client and upload to the Terraform-managed S3 + CloudFront stack.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$ROOT/infra/terraform"

cd "$TF_DIR"
BUCKET="$(terraform output -raw site_bucket)"
DIST_ID="$(terraform output -raw cloudfront_distribution_id)"
SITE_URL="$(terraform output -raw site_url)"

cd "$ROOT"
echo "Building client..."
pnpm --filter @split/client run build

echo "Uploading to s3://${BUCKET}/ ..."
aws s3 sync client/dist "s3://${BUCKET}/" --delete

echo "Invalidating CloudFront ${DIST_ID} ..."
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" --output text --query 'Invalidation.Id'

echo "Done. Public site: ${SITE_URL}"
echo "Add Google OAuth redirect URI: ${SITE_URL}/api/auth/google/callback"
