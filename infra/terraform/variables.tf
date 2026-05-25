variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "ap-southeast-1"
}

variable "aws_profile" {
  type        = string
  description = "AWS CLI config profile for the Terraform AWS provider (optional). Leave empty to use the default credential chain."
  default     = ""
  nullable    = false
}

variable "project" {
  type        = string
  description = "Name prefix for resources"
  default     = "kwh-split"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "db_password" {
  type        = string
  description = "RDS master password"
  sensitive   = true
}

variable "db_storage_gb" {
  type        = number
  description = "RDS allocated storage in GB"
  default     = 20
}

variable "jwt_secret" {
  type        = string
  description = "JWT signing secret (min 32 characters)"
  sensitive   = true
}

variable "google_client_id" {
  type        = string
  description = "Google OAuth Web client ID (optional)"
  default     = ""
  sensitive   = true
}

variable "google_client_secret" {
  type        = string
  description = "Google OAuth Web client secret (optional)"
  default     = ""
  sensitive   = true
}

variable "enable_public_site" {
  type        = bool
  description = "Create S3 + CloudFront for the Vite SPA"
  default     = true
}

variable "cloudfront_price_class" {
  type        = string
  description = "CloudFront price class (PriceClass_100 = US/EU only, cheapest)"
  default     = "PriceClass_100"
}

variable "ocr_api_key" {
  type        = string
  description = "TabScanner API key for receipt OCR (https://tabscanner.com)"
  default     = ""
  sensitive   = true
}

variable "smtp_from" {
  type        = string
  description = "SES 'Source' address for outbound mail"
  default     = ""
}

variable "site_domain" {
  type        = string
  description = "Custom hostname (e.g. kwhsplit.app). DNS managed via Cloudflare."
  default     = ""
}

variable "site_domain_aliases" {
  type        = list(string)
  description = "Extra hostnames on the same CloudFront distribution and ACM cert (e.g. www.kwhsplit.app)."
  default     = []
}

variable "cloudflare_api_token" {
  type        = string
  description = "Cloudflare API token with DNS edit permissions for the zone"
  sensitive   = true
}

variable "ec2_ssh_cidr_blocks" {
  type        = list(string)
  description = "CIDR blocks allowed to SSH into EC2"
  default     = ["0.0.0.0/0"]
}
