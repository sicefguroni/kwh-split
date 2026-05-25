resource "aws_ses_domain_identity" "site" {
  count  = local.use_custom_domain ? 1 : 0
  domain = local.site_domain_name
}

resource "aws_ses_domain_dkim" "site" {
  count  = local.use_custom_domain ? 1 : 0
  domain = aws_ses_domain_identity.site[0].domain
}

resource "aws_ses_domain_mail_from" "site" {
  count            = local.use_custom_domain ? 1 : 0
  domain           = aws_ses_domain_identity.site[0].domain
  mail_from_domain = "bounce.${aws_ses_domain_identity.site[0].domain}"
}
