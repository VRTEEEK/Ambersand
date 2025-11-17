# AWS Deployment Guide for Ambersand Compliance Management System

This guide provides step-by-step instructions to deploy the Ambersand application on AWS with a PostgreSQL database.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Step 1: Set Up AWS Account](#step-1-set-up-aws-account)
4. [Step 2: Create RDS PostgreSQL Database](#step-2-create-rds-postgresql-database)
5. [Step 3: Create S3 Bucket for File Storage](#step-3-create-s3-bucket-for-file-storage)
6. [Step 4: Set Up EC2 Instance or ECS](#step-4-set-up-ec2-instance-or-ecs)
7. [Step 5: Configure Environment Variables](#step-5-configure-environment-variables)
8. [Step 6: Deploy Application](#step-6-deploy-application)
9. [Step 7: Set Up Load Balancer & SSL](#step-7-set-up-load-balancer--ssl)
10. [Step 8: Configure Domain & DNS](#step-8-configure-domain--dns)
11. [Step 9: Set Up CI/CD Pipeline](#step-9-set-up-cicd-pipeline)
12. [Cost Estimation](#cost-estimation)
13. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- AWS Account with billing enabled
- AWS CLI installed and configured (`aws configure`)
- Node.js 20+ installed locally
- Git repository access
- Domain name (optional but recommended)
- Basic understanding of AWS services

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Route 53 (DNS)                         │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│           Application Load Balancer (SSL/HTTPS)             │
└─────────────────────────────────────────────────────────────┘
                            │
          ┌─────────────────┴─────────────────┐
          │                                   │
┌─────────▼──────────┐            ┌──────────▼─────────┐
│   EC2 Instance 1   │            │   EC2 Instance 2   │
│   (Auto Scaling)   │            │   (Auto Scaling)   │
└─────────┬──────────┘            └──────────┬─────────┘
          │                                   │
          └─────────────────┬─────────────────┘
                            │
          ┌─────────────────┴─────────────────┐
          │                                   │
┌─────────▼──────────┐            ┌──────────▼─────────┐
│  RDS PostgreSQL    │            │    S3 Bucket       │
│  (Multi-AZ)        │            │  (File Storage)    │
└────────────────────┘            └────────────────────┘
```

---

## Step 1: Set Up AWS Account

### 1.1 Install AWS CLI

```bash
# macOS
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Windows
# Download and run: https://awscli.amazonaws.com/AWSCLIV2.msi
```

### 1.2 Configure AWS CLI

```bash
aws configure
# AWS Access Key ID: <your-access-key>
# AWS Secret Access Key: <your-secret-key>
# Default region name: us-east-1 (or your preferred region)
# Default output format: json
```

### 1.3 Create IAM User with Required Permissions

Create an IAM user with the following policies:
- AmazonEC2FullAccess
- AmazonRDSFullAccess
- AmazonS3FullAccess
- AmazonVPCFullAccess
- ElasticLoadBalancingFullAccess
- AmazonRoute53FullAccess
- IAMFullAccess

---

## Step 2: Create RDS PostgreSQL Database

### 2.1 Create Database Security Group

```bash
# Create security group for database
aws ec2 create-security-group \
  --group-name ambersand-db-sg \
  --description "Security group for Ambersand PostgreSQL database" \
  --vpc-id <your-vpc-id>

# Allow PostgreSQL access from application security group
aws ec2 authorize-security-group-ingress \
  --group-id <db-security-group-id> \
  --protocol tcp \
  --port 5432 \
  --source-group <app-security-group-id>
```

### 2.2 Create RDS Instance

**Option A: Using AWS Console**

1. Go to AWS Console → RDS → Create database
2. Choose **PostgreSQL**
3. Template: **Production** (or Dev/Test for lower cost)
4. Settings:
   - DB instance identifier: `ambersand-db`
   - Master username: `ambersand_admin`
   - Master password: (generate strong password)
5. Instance configuration:
   - DB instance class: `db.t3.medium` (or `db.t4g.medium` for ARM)
   - Storage: 100 GB SSD (with autoscaling enabled)
6. Connectivity:
   - VPC: Default or custom VPC
   - Public access: **No**
   - VPC security group: `ambersand-db-sg`
7. Database options:
   - Initial database name: `ambersand`
   - PostgreSQL version: 16.x
8. Backup:
   - Enable automated backups (7-day retention)
   - Enable Multi-AZ deployment (for production)

**Option B: Using AWS CLI**

```bash
aws rds create-db-instance \
  --db-instance-identifier ambersand-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 16.1 \
  --master-username ambersand_admin \
  --master-user-password <your-strong-password> \
  --allocated-storage 100 \
  --storage-type gp3 \
  --vpc-security-group-ids <db-security-group-id> \
  --db-name ambersand \
  --backup-retention-period 7 \
  --multi-az \
  --publicly-accessible false
```

### 2.3 Get Database Connection String

```bash
# Get database endpoint
aws rds describe-db-instances \
  --db-instance-identifier ambersand-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text

# Connection string format:
# postgresql://ambersand_admin:<password>@<endpoint>:5432/ambersand
```

### 2.4 Run Database Migrations

Once the RDS instance is ready:

```bash
# Set the DATABASE_URL environment variable
export DATABASE_URL="postgresql://ambersand_admin:<password>@<endpoint>:5432/ambersand"

# Run migrations
npm run db:push

# Import ECC controls
npm run migrate:ecc
```

---

## Step 3: Create S3 Bucket for File Storage

The application currently uses local filesystem for file uploads. You'll need to migrate to S3.

### 3.1 Create S3 Bucket

```bash
# Create bucket
aws s3 mb s3://ambersand-uploads --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket ambersand-uploads \
  --versioning-configuration Status=Enabled

# Block public access
aws s3api put-public-access-block \
  --bucket ambersand-uploads \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Enable server-side encryption
aws s3api put-bucket-encryption \
  --bucket ambersand-uploads \
  --server-side-encryption-configuration \
    '{"Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]}'
```

### 3.2 Create IAM Policy for S3 Access

Create a policy file `s3-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::ambersand-uploads",
        "arn:aws:s3:::ambersand-uploads/*"
      ]
    }
  ]
}
```

```bash
# Create policy
aws iam create-policy \
  --policy-name AmbersandS3Policy \
  --policy-document file://s3-policy.json
```

---

## Step 4: Set Up EC2 Instance or ECS

You have two main options:
- **Option A**: Deploy on EC2 instances (simpler, more control)
- **Option B**: Deploy on ECS with Docker (more scalable, modern)

### Option A: EC2 Deployment

#### 4.1 Create Application Security Group

```bash
# Create security group for application
aws ec2 create-security-group \
  --group-name ambersand-app-sg \
  --description "Security group for Ambersand application" \
  --vpc-id <your-vpc-id>

# Allow HTTP traffic
aws ec2 authorize-security-group-ingress \
  --group-id <app-security-group-id> \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

# Allow HTTPS traffic
aws ec2 authorize-security-group-ingress \
  --group-id <app-security-group-id> \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

# Allow SSH access (for management)
aws ec2 authorize-security-group-ingress \
  --group-id <app-security-group-id> \
  --protocol tcp \
  --port 22 \
  --cidr <your-ip>/32
```

#### 4.2 Launch EC2 Instance

```bash
# Create key pair for SSH access
aws ec2 create-key-pair \
  --key-name ambersand-key \
  --query 'KeyMaterial' \
  --output text > ambersand-key.pem

chmod 400 ambersand-key.pem

# Launch EC2 instance (Ubuntu 22.04 LTS)
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --count 1 \
  --instance-type t3.medium \
  --key-name ambersand-key \
  --security-group-ids <app-security-group-id> \
  --iam-instance-profile Name=AmbersandEC2Role \
  --user-data file://user-data.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=ambersand-app}]'
```

#### 4.3 Create User Data Script

Create `user-data.sh`:

```bash
#!/bin/bash
set -e

# Update system
apt-get update
apt-get upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install other dependencies
apt-get install -y git nginx certbot python3-certbot-nginx

# Install PM2 for process management
npm install -g pm2

# Create application directory
mkdir -p /opt/ambersand
cd /opt/ambersand

# Clone repository (replace with your repo)
# git clone https://github.com/your-org/ambersand.git .

# Install dependencies
# npm ci --production

# Build application
# npm run build

# Start application with PM2
# pm2 start dist/index.js --name ambersand
# pm2 startup
# pm2 save

# Configure nginx as reverse proxy
cat > /etc/nginx/sites-available/ambersand << 'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/ambersand /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
```

#### 4.4 SSH into Instance and Deploy

```bash
# Get instance public IP
INSTANCE_IP=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=ambersand-app" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

# SSH into instance
ssh -i ambersand-key.pem ubuntu@$INSTANCE_IP

# Once inside:
cd /opt/ambersand
git clone <your-repo-url> .
npm ci
npm run build

# Set environment variables (see Step 5)
# Then start with PM2:
pm2 start dist/index.js --name ambersand
pm2 startup
pm2 save
```

### Option B: ECS Deployment (see Dockerfile below)

You can also deploy using ECS with Fargate for a fully managed container solution. This requires the Dockerfile we'll create next.

---

## Step 5: Configure Environment Variables

### 5.1 Create Environment File on EC2

```bash
# SSH into your EC2 instance
ssh -i ambersand-key.pem ubuntu@<instance-ip>

# Create .env file
cat > /opt/ambersand/.env << 'EOF'
# Database
DATABASE_URL=postgresql://ambersand_admin:<password>@<rds-endpoint>:5432/ambersand

# Application
NODE_ENV=production
PORT=5000
APP_BASE_URL=https://yourdomain.com

# JWT Secrets (generate with: openssl rand -hex 64)
JWT_ACCESS_SECRET=<64-char-hex-string>
JWT_REFRESH_SECRET=<64-char-hex-string>
SESSION_SECRET=<random-string>

# Email Configuration (SendGrid)
EMAIL_DRIVER=sendgrid
SENDGRID_API_KEY=<your-sendgrid-api-key>
SENDGRID_FROM_EMAIL=no-reply@yourdomain.com
SENDGRID_FROM_NAME=Ambersand

# S3 Configuration (for file uploads)
AWS_REGION=us-east-1
AWS_S3_BUCKET=ambersand-uploads
# AWS credentials will be provided by IAM role

EOF

chmod 600 /opt/ambersand/.env
```

### 5.2 Generate JWT Secrets

```bash
# Generate JWT access secret
openssl rand -hex 64

# Generate JWT refresh secret
openssl rand -hex 64

# Generate session secret
openssl rand -hex 32
```

### 5.3 Set Up SendGrid

1. Go to https://sendgrid.com
2. Create account or sign in
3. Navigate to Settings → API Keys
4. Create new API key with "Mail Send" permissions
5. Copy the API key to your `.env` file

---

## Step 6: Deploy Application

### 6.1 Manual Deployment to EC2

```bash
# On your local machine, push code to GitHub
git add .
git commit -m "Prepare for AWS deployment"
git push

# SSH into EC2 instance
ssh -i ambersand-key.pem ubuntu@<instance-ip>

# Deploy
cd /opt/ambersand
git pull origin main
npm ci
npm run build

# Run database migrations
npm run db:push
npm run migrate:ecc

# Restart application
pm2 restart ambersand

# Check status
pm2 status
pm2 logs ambersand
```

### 6.2 Set Up PM2 Monitoring

```bash
# On EC2 instance
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# Monitor
pm2 monit
```

---

## Step 7: Set Up Load Balancer & SSL

### 7.1 Create Application Load Balancer

```bash
# Create target group
aws elbv2 create-target-group \
  --name ambersand-tg \
  --protocol HTTP \
  --port 80 \
  --vpc-id <your-vpc-id> \
  --health-check-path /healthz \
  --health-check-interval-seconds 30

# Register EC2 instances to target group
aws elbv2 register-targets \
  --target-group-arn <target-group-arn> \
  --targets Id=<instance-id>

# Create Application Load Balancer
aws elbv2 create-load-balancer \
  --name ambersand-alb \
  --subnets <subnet-1> <subnet-2> \
  --security-groups <alb-security-group-id>
```

### 7.2 Request SSL Certificate

```bash
# Request certificate from ACM
aws acm request-certificate \
  --domain-name yourdomain.com \
  --subject-alternative-names www.yourdomain.com \
  --validation-method DNS

# Follow the validation instructions in AWS Console
# Then create HTTPS listener:
aws elbv2 create-listener \
  --load-balancer-arn <alb-arn> \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=<certificate-arn> \
  --default-actions Type=forward,TargetGroupArn=<target-group-arn>

# Create HTTP to HTTPS redirect
aws elbv2 create-listener \
  --load-balancer-arn <alb-arn> \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=redirect,RedirectConfig='{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}'
```

---

## Step 8: Configure Domain & DNS

### 8.1 Using Route 53

```bash
# Create hosted zone (if not exists)
aws route53 create-hosted-zone \
  --name yourdomain.com \
  --caller-reference $(date +%s)

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --names ambersand-alb \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

# Create DNS record
cat > change-batch.json << EOF
{
  "Changes": [{
    "Action": "CREATE",
    "ResourceRecordSet": {
      "Name": "yourdomain.com",
      "Type": "A",
      "AliasTarget": {
        "HostedZoneId": "<alb-hosted-zone-id>",
        "DNSName": "$ALB_DNS",
        "EvaluateTargetHealth": true
      }
    }
  }]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id <hosted-zone-id> \
  --change-batch file://change-batch.json
```

### 8.2 Update Nameservers

Go to your domain registrar and update the nameservers to the Route 53 nameservers from the hosted zone.

---

## Step 9: Set Up CI/CD Pipeline

We'll create a GitHub Actions workflow for automated deployments.

---

## Cost Estimation

### Monthly Cost Breakdown (US East 1)

| Service | Configuration | Estimated Cost |
|---------|--------------|----------------|
| **RDS PostgreSQL** | db.t3.medium, 100GB, Multi-AZ | ~$120-150 |
| **EC2 Instances** | 2x t3.medium (auto-scaling) | ~$60-120 |
| **Application Load Balancer** | With data transfer | ~$20-30 |
| **S3 Storage** | 100GB storage + requests | ~$3-10 |
| **Route 53** | Hosted zone + queries | ~$1-5 |
| **Data Transfer** | Outbound data transfer | ~$10-50 |
| **ACM Certificate** | SSL/TLS certificate | **Free** |
| **CloudWatch Logs** | Basic monitoring | ~$5-10 |

**Total Estimated Monthly Cost: $220-375**

### Cost Optimization Tips

1. **Use Reserved Instances** for EC2/RDS (up to 72% savings)
2. **Enable RDS Auto-Pause** for dev/staging environments
3. **Use S3 Intelligent-Tiering** for file storage
4. **Enable CloudFront CDN** for static assets
5. **Use Spot Instances** for non-critical workloads
6. **Set up CloudWatch Alarms** to monitor costs

---

## Troubleshooting

### Application Won't Start

```bash
# Check logs
pm2 logs ambersand

# Check if port is already in use
sudo lsof -i :5000

# Check environment variables
pm2 env 0
```

### Database Connection Issues

```bash
# Test database connection
psql "$DATABASE_URL"

# Check security group rules
aws ec2 describe-security-groups --group-ids <db-sg-id>

# Verify RDS is accessible from EC2
nc -zv <rds-endpoint> 5432
```

### File Upload Issues

```bash
# Check S3 permissions
aws s3 ls s3://ambersand-uploads

# Verify IAM role is attached to EC2
aws ec2 describe-instances \
  --instance-ids <instance-id> \
  --query 'Reservations[0].Instances[0].IamInstanceProfile'
```

### SSL Certificate Issues

```bash
# Check certificate status
aws acm describe-certificate --certificate-arn <cert-arn>

# Validate DNS records
dig yourdomain.com
```

### High Memory Usage

```bash
# Check memory usage
free -m
pm2 monit

# Adjust Node.js memory limit
pm2 delete ambersand
pm2 start dist/index.js --name ambersand --max-memory-restart 1G
```

---

## Next Steps

1. Set up automated backups for RDS
2. Configure CloudWatch alarms for monitoring
3. Implement CloudFront CDN for better performance
4. Set up WAF (Web Application Firewall) for security
5. Configure auto-scaling policies
6. Set up staging environment
7. Implement database read replicas for scalability
8. Configure VPC peering for multi-region deployment

---

## Security Checklist

- [ ] Enable MFA on AWS root account
- [ ] Use IAM roles instead of access keys on EC2
- [ ] Enable VPC Flow Logs
- [ ] Configure Security Groups with least privilege
- [ ] Enable RDS encryption at rest
- [ ] Enable S3 bucket encryption
- [ ] Rotate JWT secrets regularly
- [ ] Enable AWS CloudTrail for audit logging
- [ ] Configure AWS Config for compliance
- [ ] Set up AWS GuardDuty for threat detection
- [ ] Implement rate limiting on ALB
- [ ] Enable AWS WAF for application protection

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/your-org/ambersand/issues
- AWS Support: https://console.aws.amazon.com/support/
- Documentation: https://docs.aws.amazon.com/
