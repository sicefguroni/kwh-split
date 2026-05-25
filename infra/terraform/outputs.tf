output "site_url" {
  value       = local.public_site_url
  description = "Public SPA URL (after deploy:site uploads client/dist)"
}

output "site_domain" {
  value       = local.use_custom_domain ? local.site_domain_name : null
  description = "Custom domain hostname when configured"
}

output "cloudfront_domain_name" {
  value       = var.enable_public_site ? aws_cloudfront_distribution.site[0].domain_name : null
  description = "Default *.cloudfront.net hostname (always available when public site is enabled)"
}

output "site_bucket" {
  value       = var.enable_public_site ? aws_s3_bucket.site[0].id : null
  description = "S3 bucket for static assets — sync client/dist here"
}

output "cloudfront_distribution_id" {
  value       = var.enable_public_site ? aws_cloudfront_distribution.site[0].id : null
  description = "Use for cache invalidation after deploy:site"
}

output "rds_endpoint" {
  value       = aws_db_instance.main.endpoint
  description = "PostgreSQL hostname"
  sensitive   = true
}

output "ec2_eip" {
  value       = aws_eip.ec2.public_ip
  description = "Elastic IP of the EC2 instance (API backend)"
}

output "ec2_instance_id" {
  value       = aws_instance.main.id
  description = "EC2 instance ID"
}

output "ssh_private_key" {
  value       = tls_private_key.ec2.private_key_pem
  description = "SSH private key for EC2 access (save to .pem, chmod 400)"
  sensitive   = true
}

output "ec2_security_group_id" {
  value       = aws_security_group.ec2.id
  description = "EC2 security group"
}

output "vpc_id" {
  value = aws_vpc.main.id
}

output "direct_health_url" {
  value       = "http://${aws_eip.ec2.public_ip}:4000/api/health"
  description = "Direct health check URL (bypasses CloudFront)"
}
