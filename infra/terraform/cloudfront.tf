resource "aws_s3_bucket" "site" {
  count  = var.enable_public_site ? 1 : 0
  bucket = "${local.name}-site-${data.aws_caller_identity.current.account_id}"
  tags = {
    Name = "${local.name}-site"
  }
}

resource "aws_s3_bucket_public_access_block" "site" {
  count  = var.enable_public_site ? 1 : 0
  bucket = aws_s3_bucket.site[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_origin_access_control" "site" {
  count                             = var.enable_public_site ? 1 : 0
  name                              = "${local.name}-site-oac"
  description                       = "OAC for ${local.name} SPA bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

data "aws_caller_identity" "current" {}

resource "aws_cloudfront_distribution" "site" {
  count = var.enable_public_site ? 1 : 0

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${local.name} SPA"
  default_root_object = "index.html"
  price_class         = var.cloudfront_price_class
  aliases             = local.cloudfront_aliases

  # S3 static files origin (unchanged)
  origin {
    domain_name              = aws_s3_bucket.site[0].bucket_regional_domain_name
    origin_id                = "s3-site"
    origin_access_control_id = aws_cloudfront_origin_access_control.site[0].id
  }

  # API origin → EC2 (replaces ALB)
  origin {
    domain_name = aws_eip.ec2.public_dns
    origin_id   = "ec2-api"

    connection_attempts = 3
    connection_timeout  = 10

    custom_origin_config {
      http_port              = 4000
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "s3-site"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = data.aws_cloudfront_cache_policy.s3_static[0].id
  }

  # WebSocket /api/realtime — listed before /api/* (more specific path wins)
  ordered_cache_behavior {
    path_pattern             = "/api/realtime"
    target_origin_id         = "ec2-api"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.api_origin[0].id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.api_alb[0].id
  }

  ordered_cache_behavior {
    path_pattern             = "/api/*"
    target_origin_id         = "ec2-api"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.api_origin[0].id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.api_alb[0].id
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  dynamic "viewer_certificate" {
    for_each = local.use_custom_domain ? [1] : []
    content {
      acm_certificate_arn      = aws_acm_certificate.site[0].arn
      ssl_support_method       = "sni-only"
      minimum_protocol_version = "TLSv1.2_2019"
    }
  }

  dynamic "viewer_certificate" {
    for_each = local.use_custom_domain ? [] : [1]
    content {
      cloudfront_default_certificate = true
    }
  }

  tags = {
    Name = "${local.name}-cdn"
  }
}

data "aws_cloudfront_cache_policy" "s3_static" {
  count = var.enable_public_site ? 1 : 0
  name  = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "api_origin" {
  count = var.enable_public_site ? 1 : 0
  name  = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "api_alb" {
  count = var.enable_public_site ? 1 : 0
  name  = "Managed-AllViewer"
}

resource "aws_s3_bucket_policy" "site" {
  count  = var.enable_public_site ? 1 : 0
  bucket = aws_s3_bucket.site[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontRead"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.site[0].arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.site[0].arn
          }
        }
      },
    ]
  })
}
