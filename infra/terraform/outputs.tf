output "alb_dns_name" {
  value       = aws_lb.main.dns_name
  description = "ALB DNS (HTTP :80) — point CloudFront or DNS here after replacing placeholder tasks."
}

output "api_health_url" {
  value       = "http://${aws_lb.main.dns_name}/api/health"
  description = "Smoke-test URL after terraform apply and ECS tasks are healthy"
}

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

output "ecr_api_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "ecr_worker_repository_url" {
  value = aws_ecr_repository.worker.repository_url
}

output "rds_endpoint" {
  value       = aws_rds_cluster.main.endpoint
  description = "PostgreSQL hostname for DATABASE_URL"
}

output "rds_security_group_id" {
  value       = aws_security_group.rds.id
  description = "RDS security group — use for temporary migrate access from your IP (see server/docs/database.md)"
}

output "redis_primary_endpoint" {
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  description = "Redis hostname for REDIS_URL (add redis:// prefix in app)"
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "vpc_id" {
  value = aws_vpc.main.id
}

output "ecs_public_subnet_ids" {
  value       = aws_subnet.public[*].id
  description = "Subnets used by ECS services (Fargate) — same subnets work for run-task migration jobs"
}

output "ecs_tasks_security_group_id" {
  value       = aws_security_group.ecs.id
  description = "Security group attached to ECS tasks — use with run-task so the task can reach RDS and Redis"
}
