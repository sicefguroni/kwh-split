data "cloudflare_zone" "main" {
  name = local.site_domain_name
}

resource "cloudflare_record" "root" {
  count   = local.use_custom_domain ? 1 : 0
  zone_id = data.cloudflare_zone.main.id
  name    = "@"
  type    = "CNAME"
  content = aws_cloudfront_distribution.site[0].domain_name
  proxied = true
}

resource "cloudflare_record" "www" {
  for_each = local.use_custom_domain ? toset(var.site_domain_aliases) : toset([])
  zone_id  = data.cloudflare_zone.main.id
  name     = each.key
  type     = "CNAME"
  content  = aws_cloudfront_distribution.site[0].domain_name
  proxied  = true
}

resource "cloudflare_record" "ses_dkim" {
  count   = local.use_custom_domain ? 3 : 0
  zone_id = data.cloudflare_zone.main.id
  name    = "${aws_ses_domain_dkim.site[0].dkim_tokens[count.index]}._domainkey"
  type    = "CNAME"
  content = "${aws_ses_domain_dkim.site[0].dkim_tokens[count.index]}.dkim.amazonses.com"
  proxied = false
}

resource "cloudflare_record" "ses_mail_from_mx" {
  count    = local.use_custom_domain ? 1 : 0
  zone_id  = data.cloudflare_zone.main.id
  name     = "bounce"
  type     = "MX"
  content  = "feedback-smtp.${var.aws_region}.amazonses.com"
  priority = 10
  proxied  = false
}

resource "cloudflare_record" "ses_mail_from_txt" {
  count   = local.use_custom_domain ? 1 : 0
  zone_id = data.cloudflare_zone.main.id
  name    = "bounce"
  type    = "TXT"
  content = "v=spf1 include:amazonses.com ~all"
  proxied = false
}

resource "cloudflare_record" "ses_dmarc" {
  count   = local.use_custom_domain ? 1 : 0
  zone_id = data.cloudflare_zone.main.id
  name    = "_dmarc"
  type    = "TXT"
  content = "v=DMARC1; p=none;"
  proxied = false
}

resource "cloudflare_record" "site_cert_validation" {
  for_each = local.use_custom_domain ? {
    for dvo in aws_acm_certificate.site[0].domain_validation_options : dvo.domain_name => {
      name   = trimsuffix(trimsuffix(dvo.resource_record_name, "."), ".${local.site_domain_name}")
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  zone_id = data.cloudflare_zone.main.id
  name    = each.value.name
  type    = each.value.type
  content = each.value.record
  proxied = false
}
