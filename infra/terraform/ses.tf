resource "aws_ses_domain_identity" "site" {
  count  = local.use_custom_domain ? 1 : 0
  domain = local.site_domain_name
}

resource "aws_ses_domain_dkim" "site" {
  count  = local.use_custom_domain ? 1 : 0
  domain = aws_ses_domain_identity.site[0].domain
}

resource "aws_route53_record" "ses_dkim" {
  count   = local.use_custom_domain ? 3 : 0
  zone_id = var.route53_zone_id
  name    = "${aws_ses_domain_dkim.site[0].dkim_tokens[count.index]}._domainkey"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_ses_domain_dkim.site[0].dkim_tokens[count.index]}.dkim.amazonses.com"]
}

resource "aws_ses_domain_mail_from" "site" {
  count            = local.use_custom_domain ? 1 : 0
  domain           = aws_ses_domain_identity.site[0].domain
  mail_from_domain = "bounce.${aws_ses_domain_identity.site[0].domain}"
}

resource "aws_route53_record" "ses_mail_from_mx" {
  count   = local.use_custom_domain ? 1 : 0
  zone_id = var.route53_zone_id
  name    = aws_ses_domain_mail_from.site[0].mail_from_domain
  type    = "MX"
  ttl     = 600
  records = ["10 feedback-smtp.${var.aws_region}.amazonses.com"]
}

resource "aws_route53_record" "ses_mail_from_txt" {
  count   = local.use_custom_domain ? 1 : 0
  zone_id = var.route53_zone_id
  name    = aws_ses_domain_mail_from.site[0].mail_from_domain
  type    = "TXT"
  ttl     = 600
  records = ["v=spf1 include:amazonses.com ~all"]
}

resource "aws_route53_record" "ses_dmarc_txt" {
  count           = local.use_custom_domain ? 1 : 0
  zone_id         = var.route53_zone_id
  name            = "_dmarc.${aws_ses_domain_identity.site[0].domain}"
  type            = "TXT"
  ttl             = 600
  records         = ["v=DMARC1; p=none;"]
  allow_overwrite = true
}
