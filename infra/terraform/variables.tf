variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "ap-southeast-1"
}

variable "aws_profile" {
  type        = string
  description = "AWS CLI config profile for the Terraform AWS provider (optional). Use when AWS_PROFILE is not inherited (e.g. some IDE integrations). Leave empty to use the default credential chain."
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

variable "jwt_secret" {
  type        = string
  description = "JWT signing secret (min 32 characters)"
  sensitive   = true
}

variable "google_client_id" {
  type        = string
  description = "Google OAuth Web client ID (optional; required for Sign in with Google)"
  default     = ""
  sensitive   = true
}

variable "google_client_secret" {
  type        = string
  description = "Google OAuth Web client secret (optional)"
  default     = ""
  sensitive   = true
}

variable "api_image_tag" {
  type        = string
  description = "ECR image tag for the API container"
  default     = "migrate"
}

variable "worker_image_tag" {
  type        = string
  description = "ECR image tag for the notification worker container"
  default     = "migrate"
}

variable "ecs_desired_count_api" {
  type    = number
  default = 1
}

variable "ecs_desired_count_worker" {
  type    = number
  default = 1
}

variable "enable_public_site" {
  type        = bool
  description = "Create S3 + CloudFront for the Vite SPA (/api/* → ALB)"
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

variable "smtp_host" {
  type        = string
  description = "SMTP host for group invitation emails (optional)"
  default     = ""
}

variable "smtp_port" {
  type        = number
  description = "SMTP port (465 SSL, 587 STARTTLS, 25 plain)"
  default     = 0
}

variable "smtp_user" {
  type        = string
  description = "SMTP username (optional)"
  default     = ""
  sensitive   = true
}

variable "smtp_pass" {
  type        = string
  description = "SMTP password (optional)"
  default     = ""
  sensitive   = true
}

variable "smtp_from" {
  type        = string
  description = "From address for outbound mail, e.g. Split <noreply@yourdomain.com>"
  default     = ""
}

variable "site_domain" {
  type        = string
  description = "Custom hostname for the public site (e.g. app.example.com). Leave empty to keep the default *.cloudfront.net URL."
  default     = ""

  validation {
    condition     = trimspace(var.site_domain) == "" || trimspace(var.route53_zone_id) != ""
    error_message = "route53_zone_id must be set when site_domain is set."
  }
}

variable "route53_zone_id" {
  type        = string
  description = "Route 53 hosted zone ID for ACM DNS validation and alias records to CloudFront. Required when site_domain is set."
  default     = ""
}

variable "site_domain_aliases" {
  type        = list(string)
  description = "Extra hostnames on the same CloudFront distribution and ACM cert (e.g. www.example.com)."
  default     = []

  validation {
    condition     = trimspace(var.site_domain) != "" || length(var.site_domain_aliases) == 0
    error_message = "site_domain_aliases requires site_domain to be set."
  }
}

variable "web_origin_override" {
  type        = string
  description = "Override WEB_ORIGIN / OAUTH_CALLBACK_BASE_URL (e.g. CloudFront default URL when custom domain is broken). Leave empty to derive from site_domain."
  default     = ""
}
