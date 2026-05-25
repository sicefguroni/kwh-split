data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-kernel-6.1-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "tls_private_key" "ec2" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "ec2" {
  key_name   = "${local.name}-ec2-key"
  public_key = tls_private_key.ec2.public_key_openssh

  tags = {
    Name = "${local.name}-ec2-key"
  }
}

data "aws_ec2_managed_prefix_list" "cloudfront_origin" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_security_group" "ec2" {
  name        = "${local.name}-ec2"
  description = "EC2 - API from CloudFront, SSH from admin"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 4000
    to_port         = 4000
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.cloudfront_origin.id]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ec2_ssh_cidr_blocks
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name}-ec2"
  }
}

resource "aws_iam_role" "ec2" {
  name = "${local.name}-ec2-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "ec2_ses" {
  name = "${local.name}-ec2-ses"
  role = aws_iam_role.ec2.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action   = ["ses:SendEmail", "ses:SendRawEmail"]
      Effect   = "Allow"
      Resource = "*"
    }]
  })
}

resource "aws_iam_role_policy" "ec2_s3_sync" {
  count = var.enable_public_site ? 1 : 0
  name  = "${local.name}-ec2-s3-sync"
  role  = aws_iam_role.ec2.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = ["s3:PutObject", "s3:GetObject", "s3:ListBucket", "s3:DeleteObject"]
      Effect = "Allow"
      Resource = [
        aws_s3_bucket.site[0].arn,
        "${aws_s3_bucket.site[0].arn}/*",
      ]
    }]
  })
}

resource "aws_iam_role_policy" "ec2_cf_invalidation" {
  count = var.enable_public_site ? 1 : 0
  name  = "${local.name}-ec2-cf-invalidation"
  role  = aws_iam_role.ec2.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action   = ["cloudfront:CreateInvalidation"]
      Effect   = "Allow"
      Resource = aws_cloudfront_distribution.site[0].arn
    }]
  })
}

resource "aws_iam_instance_profile" "ec2" {
  name = "${local.name}-ec2-profile"
  role = aws_iam_role.ec2.name
}

resource "aws_eip" "ec2" {
  domain = "vpc"
  tags = {
    Name = "${local.name}-eip"
  }
}

resource "aws_instance" "main" {
  ami           = data.aws_ami.amazon_linux_2023.id
  instance_type = "t2.micro"

  subnet_id                   = aws_subnet.public[0].id
  vpc_security_group_ids      = [aws_security_group.ec2.id]
  associate_public_ip_address = true

  key_name             = aws_key_pair.ec2.key_name
  iam_instance_profile = aws_iam_instance_profile.ec2.name

  user_data = templatefile("${path.module}/user-data.sh.tftpl", {
    database_url         = "postgresql://${local.db_user}:${urlencode(var.db_password)}@${aws_db_instance.main.endpoint}/${local.db_name}?sslmode=no-verify"
    jwt_secret           = var.jwt_secret
    aws_region           = var.aws_region
    site_domain          = local.site_domain_name
    site_bucket          = var.enable_public_site ? aws_s3_bucket.site[0].id : ""
    cf_dist_id           = var.enable_public_site ? aws_cloudfront_distribution.site[0].id : ""
    smtp_from            = var.smtp_from
    google_client_id     = var.google_client_id
    google_client_secret = var.google_client_secret
    ocr_api_key          = var.ocr_api_key
  })

  user_data_replace_on_change = true

  depends_on = [aws_db_instance.main]

  tags = {
    Name = "${local.name}-ec2"
  }
}

resource "aws_eip_association" "ec2" {
  instance_id   = aws_instance.main.id
  allocation_id = aws_eip.ec2.id
}
