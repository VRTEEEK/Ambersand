# Main Terraform configuration for Ambersand AWS deployment

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # Uncomment to use S3 backend for state management
  # backend "s3" {
  #   bucket         = "ambersand-terraform-state"
  #   key            = "prod/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-state-lock"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "Ambersand"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# VPC and Networking
module "vpc" {
  source = "./modules/vpc"

  environment         = var.environment
  vpc_cidr            = var.vpc_cidr
  availability_zones  = var.availability_zones
  public_subnet_cidrs = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
}

# Security Groups
module "security_groups" {
  source = "./modules/security_groups"

  environment = var.environment
  vpc_id      = module.vpc.vpc_id
}

# RDS PostgreSQL Database
module "database" {
  source = "./modules/database"

  environment             = var.environment
  db_instance_class       = var.db_instance_class
  db_allocated_storage    = var.db_allocated_storage
  db_name                 = var.db_name
  db_username             = var.db_username
  db_password             = var.db_password
  db_multi_az             = var.db_multi_az
  private_subnet_ids      = module.vpc.private_subnet_ids
  db_security_group_id    = module.security_groups.db_security_group_id
}

# S3 Bucket for file uploads
module "storage" {
  source = "./modules/storage"

  environment = var.environment
  bucket_name = var.s3_bucket_name
}

# Application Load Balancer
module "alb" {
  source = "./modules/alb"

  environment             = var.environment
  vpc_id                  = module.vpc.vpc_id
  public_subnet_ids       = module.vpc.public_subnet_ids
  alb_security_group_id   = module.security_groups.alb_security_group_id
  certificate_arn         = var.certificate_arn
  domain_name             = var.domain_name
}

# EC2 Auto Scaling Group
module "compute" {
  source = "./modules/compute"

  environment             = var.environment
  vpc_id                  = module.vpc.vpc_id
  private_subnet_ids      = module.vpc.private_subnet_ids
  app_security_group_id   = module.security_groups.app_security_group_id
  target_group_arn        = module.alb.target_group_arn
  instance_type           = var.instance_type
  min_size                = var.asg_min_size
  max_size                = var.asg_max_size
  desired_capacity        = var.asg_desired_capacity
  key_name                = var.key_name
  s3_bucket_arn           = module.storage.bucket_arn

  # Application configuration
  database_url            = module.database.connection_string
  app_base_url            = "https://${var.domain_name}"
  jwt_access_secret       = var.jwt_access_secret
  jwt_refresh_secret      = var.jwt_refresh_secret
  session_secret          = var.session_secret
  sendgrid_api_key        = var.sendgrid_api_key
  sendgrid_from_email     = var.sendgrid_from_email
  s3_bucket_name          = module.storage.bucket_name
}

# Route 53 DNS
module "dns" {
  source = "./modules/dns"
  count  = var.create_route53_record ? 1 : 0

  domain_name     = var.domain_name
  alb_dns_name    = module.alb.alb_dns_name
  alb_zone_id     = module.alb.alb_zone_id
}

# CloudWatch Monitoring
module "monitoring" {
  source = "./modules/monitoring"

  environment     = var.environment
  alb_arn_suffix  = module.alb.alb_arn_suffix
  target_group_arn_suffix = module.alb.target_group_arn_suffix
  asg_name        = module.compute.asg_name
  db_instance_id  = module.database.db_instance_id
}
