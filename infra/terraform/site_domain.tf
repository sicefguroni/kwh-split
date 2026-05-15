locals {
  use_custom_domain  = var.enable_public_site && trimspace(var.site_domain) != ""
  site_domain_name   = trimspace(var.site_domain)
  cloudfront_aliases = local.use_custom_domain ? concat([local.site_domain_name], var.site_domain_aliases) : []
  public_site_url = var.enable_public_site ? (
    local.use_custom_domain ? "https://${local.site_domain_name}" : "https://${aws_cloudfront_distribution.site[0].domain_name}"
  ) : null
}
