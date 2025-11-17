# Terraform outputs for Ambersand AWS deployment

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = module.vpc.private_subnet_ids
}

output "database_endpoint" {
  description = "RDS database endpoint"
  value       = module.database.db_endpoint
}

output "database_connection_string" {
  description = "Database connection string (sensitive)"
  value       = module.database.connection_string
  sensitive   = true
}

output "s3_bucket_name" {
  description = "S3 bucket name for uploads"
  value       = module.storage.bucket_name
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN"
  value       = module.storage.bucket_arn
}

output "alb_dns_name" {
  description = "Application Load Balancer DNS name"
  value       = module.alb.alb_dns_name
}

output "alb_url" {
  description = "Application Load Balancer URL"
  value       = "https://${module.alb.alb_dns_name}"
}

output "application_url" {
  description = "Application URL (domain or ALB)"
  value       = var.domain_name != "" ? "https://${var.domain_name}" : "https://${module.alb.alb_dns_name}"
}

output "asg_name" {
  description = "Auto Scaling Group name"
  value       = module.compute.asg_name
}

output "iam_instance_profile_name" {
  description = "IAM instance profile name"
  value       = module.compute.iam_instance_profile_name
}

output "app_security_group_id" {
  description = "Application security group ID"
  value       = module.security_groups.app_security_group_id
}

output "db_security_group_id" {
  description = "Database security group ID"
  value       = module.security_groups.db_security_group_id
}

output "alb_security_group_id" {
  description = "ALB security group ID"
  value       = module.security_groups.alb_security_group_id
}

output "deployment_instructions" {
  description = "Next steps for deployment"
  value       = <<-EOT

    Deployment Complete!

    Next Steps:
    1. Access your application at: ${var.domain_name != "" ? "https://${var.domain_name}" : "https://${module.alb.alb_dns_name}"}
    2. SSH into an EC2 instance to run database migrations:
       aws ec2 describe-instances --filters "Name=tag:Name,Values=ambersand-app-${var.environment}" --query 'Reservations[0].Instances[0].PrivateIpAddress'
    3. Set up monitoring in CloudWatch
    4. Configure backups and snapshots
    5. Set up CI/CD pipeline with GitHub Actions

    Database:
    - Endpoint: ${module.database.db_endpoint}
    - Name: ${var.db_name}
    - Username: ${var.db_username}

    Storage:
    - S3 Bucket: ${module.storage.bucket_name}

    Monitoring:
    - CloudWatch Dashboard: https://console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}

  EOT
}
