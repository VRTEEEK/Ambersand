# Terraform Infrastructure for Ambersand

This directory contains Terraform configuration files to deploy the Ambersand compliance management system on AWS.

## Prerequisites

1. **Terraform** (>= 1.0)
   ```bash
   brew install terraform  # macOS
   # or download from: https://www.terraform.io/downloads
   ```

2. **AWS CLI** configured with credentials
   ```bash
   aws configure
   ```

3. **AWS Account** with appropriate permissions

4. **Domain Name** and **ACM Certificate** (for HTTPS)

## Quick Start

### 1. Initialize Terraform

```bash
cd terraform
terraform init
```

### 2. Create terraform.tfvars

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your values:

```hcl
# Generate secrets
openssl rand -hex 64  # JWT access secret
openssl rand -hex 64  # JWT refresh secret
openssl rand -hex 32  # Session secret

# Update terraform.tfvars with generated values
```

### 3. Create EC2 Key Pair

```bash
aws ec2 create-key-pair \
  --key-name ambersand-key \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/ambersand-key.pem

chmod 400 ~/.ssh/ambersand-key.pem
```

### 4. Request ACM Certificate

```bash
aws acm request-certificate \
  --domain-name yourdomain.com \
  --subject-alternative-names www.yourdomain.com \
  --validation-method DNS \
  --region us-east-1

# Follow DNS validation instructions
# Copy the certificate ARN to terraform.tfvars
```

### 5. Plan Infrastructure

```bash
terraform plan
```

Review the planned changes carefully.

### 6. Apply Infrastructure

```bash
terraform apply
```

Type `yes` to confirm. This will create:
- VPC with public and private subnets
- RDS PostgreSQL database (Multi-AZ)
- S3 bucket for file uploads
- Application Load Balancer with HTTPS
- Auto Scaling Group with EC2 instances
- Security groups
- IAM roles and policies
- CloudWatch monitoring

**Note:** This process takes 15-20 minutes, especially for RDS.

### 7. Deploy Application

Once Terraform completes:

```bash
# Get the ALB DNS name
terraform output alb_dns_name

# Get the database connection string
terraform output -raw database_connection_string

# SSH into an EC2 instance (you'll need to use a bastion or VPN)
# Then deploy your application code
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Route 53 (DNS)                         │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│           Application Load Balancer (SSL/HTTPS)             │
│              Public Subnets (10.0.1.0/24, 10.0.2.0/24)      │
└─────────────────────────────────────────────────────────────┘
                            │
          ┌─────────────────┴─────────────────┐
          │                                   │
┌─────────▼──────────┐            ┌──────────▼─────────┐
│   EC2 Instance 1   │            │   EC2 Instance 2   │
│   Private Subnet   │            │   Private Subnet   │
│   10.0.11.0/24     │            │   10.0.12.0/24     │
└─────────┬──────────┘            └──────────┬─────────┘
          │                                   │
          └─────────────────┬─────────────────┘
                            │
          ┌─────────────────┴─────────────────┐
          │                                   │
┌─────────▼──────────┐            ┌──────────▼─────────┐
│  RDS PostgreSQL    │            │    S3 Bucket       │
│  Multi-AZ          │            │  (File Storage)    │
│  Private Subnets   │            │                    │
└────────────────────┘            └────────────────────┘
```

## Module Structure

- **vpc**: VPC, subnets, internet gateway, NAT gateway, route tables
- **security_groups**: Security groups for ALB, application, and database
- **database**: RDS PostgreSQL with Multi-AZ, automated backups
- **storage**: S3 bucket with encryption and versioning
- **alb**: Application Load Balancer with HTTPS listener
- **compute**: Auto Scaling Group, Launch Template, IAM roles
- **dns**: Route 53 DNS records (optional)
- **monitoring**: CloudWatch alarms and dashboards

## Modules

### VPC Module

Creates:
- VPC with configurable CIDR
- 2 public subnets (for ALB)
- 2 private subnets (for EC2 and RDS)
- Internet Gateway
- NAT Gateway (for private subnet internet access)
- Route tables

### Security Groups Module

Creates:
- ALB Security Group (allows 80, 443 from internet)
- Application Security Group (allows traffic from ALB)
- Database Security Group (allows 5432 from Application)

### Database Module

Creates:
- RDS PostgreSQL 16 instance
- DB subnet group
- Automated backups (7-day retention)
- Multi-AZ for high availability
- Encryption at rest

### Storage Module

Creates:
- S3 bucket with versioning
- Server-side encryption (AES-256)
- Block public access
- Lifecycle policies

### ALB Module

Creates:
- Application Load Balancer
- Target group with health checks
- HTTPS listener (port 443)
- HTTP to HTTPS redirect (port 80)

### Compute Module

Creates:
- Launch template with user data
- Auto Scaling Group (1-4 instances)
- IAM instance profile with S3 access
- CloudWatch agent for logging

### DNS Module (Optional)

Creates:
- Route 53 record pointing to ALB

### Monitoring Module

Creates:
- CloudWatch alarms for:
  - High CPU usage
  - High memory usage
  - Unhealthy target count
  - Database CPU/storage
- CloudWatch dashboard

## Outputs

After `terraform apply`, you'll see:

- `application_url`: URL to access your application
- `database_endpoint`: RDS endpoint
- `s3_bucket_name`: S3 bucket for uploads
- `alb_dns_name`: Load balancer DNS name
- `deployment_instructions`: Next steps

View outputs:

```bash
terraform output
terraform output -raw database_connection_string
```

## Deployment Commands

```bash
# Initialize
terraform init

# Validate configuration
terraform validate

# Format code
terraform fmt -recursive

# Plan changes
terraform plan -out=tfplan

# Apply changes
terraform apply tfplan

# Show current state
terraform show

# List resources
terraform state list

# Destroy everything (BE CAREFUL!)
terraform destroy
```

## State Management

### Local State (Default)

State is stored locally in `terraform.tfstate`. **Back this up!**

### Remote State (Recommended for Production)

Use S3 backend for remote state:

1. Create S3 bucket and DynamoDB table:

```bash
aws s3 mb s3://ambersand-terraform-state
aws dynamodb create-table \
  --table-name terraform-state-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

2. Uncomment the backend configuration in `main.tf`:

```hcl
backend "s3" {
  bucket         = "ambersand-terraform-state"
  key            = "prod/terraform.tfstate"
  region         = "us-east-1"
  encrypt        = true
  dynamodb_table = "terraform-state-lock"
}
```

3. Initialize backend:

```bash
terraform init -migrate-state
```

## Managing Secrets

**Never commit secrets to Git!**

### Option 1: Use terraform.tfvars (Local)

Create `terraform.tfvars` with secrets (this file is in .gitignore):

```hcl
db_password        = "your-password"
jwt_access_secret  = "your-secret"
```

### Option 2: Use AWS Secrets Manager

```bash
# Store secrets
aws secretsmanager create-secret \
  --name ambersand/prod/db-password \
  --secret-string "your-password"

# Reference in Terraform
data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = "ambersand/prod/db-password"
}
```

### Option 3: Use Environment Variables

```bash
export TF_VAR_db_password="your-password"
export TF_VAR_jwt_access_secret="your-secret"
terraform apply
```

## Cost Optimization

### Development Environment

For lower costs in dev/staging:

```hcl
# terraform.tfvars
environment          = "dev"
db_instance_class    = "db.t3.small"
db_multi_az          = false
instance_type        = "t3.small"
asg_min_size         = 1
asg_max_size         = 2
asg_desired_capacity = 1
```

### Production Environment

```hcl
environment          = "prod"
db_instance_class    = "db.t3.medium"
db_multi_az          = true
instance_type        = "t3.medium"
asg_min_size         = 2
asg_max_size         = 6
asg_desired_capacity = 2
```

## Troubleshooting

### Terraform Init Fails

```bash
# Clear cache
rm -rf .terraform
terraform init
```

### Apply Fails Due to Limits

Check AWS service limits:
- VPC limit (default: 5 per region)
- Elastic IP limit (default: 5 per region)
- EC2 instance limit

### RDS Creation Times Out

RDS can take 15-20 minutes to create. Increase timeout if needed.

### Can't SSH to Instances

EC2 instances are in private subnets. Use:
1. AWS Systems Manager Session Manager
2. Bastion host in public subnet
3. VPN connection

## Updating Infrastructure

```bash
# Make changes to .tf files
# Plan the changes
terraform plan

# Apply changes
terraform apply

# If you need to replace a resource
terraform taint module.compute.aws_launch_template.app
terraform apply
```

## Destroying Infrastructure

```bash
# Preview what will be destroyed
terraform plan -destroy

# Destroy everything
terraform destroy

# Destroy specific resource
terraform destroy -target=module.compute
```

## Next Steps

1. Set up CI/CD pipeline (see `../.github/workflows/`)
2. Configure application code deployment
3. Run database migrations
4. Set up monitoring alerts
5. Configure backups
6. Set up CloudFront CDN
7. Implement WAF rules

## Additional Resources

- [Terraform AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [Terraform Best Practices](https://www.terraform-best-practices.com/)
