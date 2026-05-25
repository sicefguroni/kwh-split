resource "aws_acm_certificate" "site" {
  count    = local.use_custom_domain ? 1 : 0
  provider = aws.us_east_1

  domain_name               = local.site_domain_name
  subject_alternative_names = var.site_domain_aliases
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${local.name}-site-cert"
  }
}

resource "aws_acm_certificate_validation" "site" {
  count    = local.use_custom_domain ? 1 : 0
  provider = aws.us_east_1

  certificate_arn = aws_acm_certificate.site[0].arn

  validation_record_fqdns = [
    for record in cloudflare_record.site_cert_validation : "${record.name}.${local.site_domain_name}"
  ]
}
