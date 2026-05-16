resource "aws_route53_record" "site_a" {
  count   = local.use_custom_domain ? 1 : 0
  zone_id = var.route53_zone_id
  name    = local.site_domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.site[0].domain_name
    zone_id                = aws_cloudfront_distribution.site[0].hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "site_aaaa" {
  count   = local.use_custom_domain ? 1 : 0
  zone_id = var.route53_zone_id
  name    = local.site_domain_name
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.site[0].domain_name
    zone_id                = aws_cloudfront_distribution.site[0].hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "site_alias_a" {
  for_each = local.use_custom_domain ? toset(var.site_domain_aliases) : toset([])
  zone_id  = var.route53_zone_id
  name     = each.key
  type     = "A"

  alias {
    name                   = aws_cloudfront_distribution.site[0].domain_name
    zone_id                = aws_cloudfront_distribution.site[0].hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "site_alias_aaaa" {
  for_each = local.use_custom_domain ? toset(var.site_domain_aliases) : toset([])
  zone_id  = var.route53_zone_id
  name     = each.key
  type     = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.site[0].domain_name
    zone_id                = aws_cloudfront_distribution.site[0].hosted_zone_id
    evaluate_target_health = false
  }
}
