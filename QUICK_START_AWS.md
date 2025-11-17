# Quick Start: Deploy Ambersand to AWS

This guide will get your Ambersand application running on AWS in about 30-45 minutes.

## Prerequisites

- AWS account with billing enabled
- Domain name (optional but recommended)
- Terraform installed: `brew install terraform` (or download from terraform.io)
- AWS CLI installed and configured: `aws configure`

## Quick Deployment Steps

### Step 1: Generate Secrets (2 minutes)

```bash
# Generate JWT secrets
echo "JWT_ACCESS_SECRET=$(openssl rand -hex 64)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 64)"
echo "SESSION_SECRET=$(openssl rand -hex 32)"

# Save these values - you'll need them!
```

### Step 2: Set Up SendGrid (5 minutes)

1. Go to https://sendgrid.com and create an account
2. Navigate to Settings → API Keys
3. Create new API key with "Mail Send" permission
4. Save the API key securely

### Step 3: Request SSL Certificate (5 minutes)

```bash
aws acm request-certificate \
  --domain-name yourdomain.com \
  --subject-alternative-names www.yourdomain.com \
  --validation-method DNS \
  --region us-east-1

# Follow the email/DNS validation instructions
# Save the certificate ARN
```

### Step 4: Configure Terraform (3 minutes)

```bash
cd terraform

# Copy example configuration
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars

# Update these values:
# - domain_name
# - certificate_arn
# - db_password
# - jwt_access_secret
# - jwt_refresh_secret
# - session_secret
# - sendgrid_api_key
# - sendgrid_from_email
# - s3_bucket_name (must be globally unique)
```

### Step 5: Create EC2 Key Pair (1 minute)

```bash
aws ec2 create-key-pair \
  --key-name ambersand-key \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/ambersand-key.pem

chmod 400 ~/.ssh/ambersand-key.pem
```

### Step 6: Deploy Infrastructure (20 minutes)

```bash
cd terraform

# Initialize Terraform
terraform init

# Review what will be created
terraform plan

# Deploy (this takes about 15-20 minutes)
terraform apply

# Type 'yes' when prompted
```

### Step 7: Deploy Application (5 minutes)

Once Terraform completes:

```bash
# Get outputs
terraform output

# The deployment script is already on the EC2 instances
# Connect via AWS Systems Manager Session Manager or SSH

# Using Session Manager (recommended):
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=ambersand-app-prod" \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text)

aws ssm start-session --target $INSTANCE_ID

# Once connected, the application should already be running!
# Check status:
pm2 status
pm2 logs ambersand
```

### Step 8: Run Database Migrations (3 minutes)

```bash
# On the EC2 instance:
cd /opt/ambersand

# Check .env file has correct DATABASE_URL
cat .env | grep DATABASE_URL

# Run migrations
npm run db:push
npm run migrate:ecc

# Restart application
pm2 restart ambersand
```

### Step 9: Update DNS (5 minutes)

```bash
# Get your ALB DNS name
terraform output alb_dns_name

# If using Route 53 (and set create_route53_record = true):
# DNS is already configured!

# If using another DNS provider:
# Create a CNAME record pointing your domain to the ALB DNS name
```

### Step 10: Test Your Deployment (2 minutes)

```bash
# Test health endpoint
curl https://yourdomain.com/healthz

# Visit in browser
open https://yourdomain.com

# You should see the Ambersand login page!
```

## That's It!

Your Ambersand application is now running on AWS! 🎉

## What Got Deployed?

- ✅ VPC with public and private subnets across 2 availability zones
- ✅ RDS PostgreSQL database (Multi-AZ for high availability)
- ✅ S3 bucket for file uploads
- ✅ Application Load Balancer with HTTPS
- ✅ Auto Scaling Group with 2 EC2 instances
- ✅ CloudWatch monitoring and alarms
- ✅ Security groups and IAM roles
- ✅ Your application running with PM2

## Next Steps

1. **Set Up CI/CD**: Configure GitHub Actions for automated deployments
   ```bash
   # Add these secrets to your GitHub repository:
   # - AWS_ACCESS_KEY_ID
   # - AWS_SECRET_ACCESS_KEY
   # - DEPLOYMENT_BUCKET
   ```

2. **Configure Monitoring**: Set up alerts in CloudWatch
   ```bash
   # CloudWatch dashboard URL:
   echo "https://console.aws.amazon.com/cloudwatch/home?region=us-east-1"
   ```

3. **Test Your Application**: Create an account and test all features

4. **Set Up Backups**: Schedule regular RDS snapshots
   ```bash
   ./scripts/aws/backup-rds.sh
   ```

5. **Enable Auto-Scaling**: Configure scaling policies based on CPU/memory

## Quick Commands

```bash
# Check application status
pm2 status

# View logs
pm2 logs ambersand

# Restart application
pm2 restart ambersand

# View Terraform outputs
cd terraform && terraform output

# Create database backup
./scripts/aws/backup-rds.sh

# Deploy new version
git pull && npm ci && npm run build && pm2 reload ambersand
```

## Troubleshooting

### Application won't start
```bash
pm2 logs ambersand --lines 50
```

### Can't connect to database
```bash
psql "$DATABASE_URL" -c "SELECT 1"
```

### Load balancer shows unhealthy
```bash
# Check health endpoint locally
curl http://localhost:5000/healthz

# Check target group health
aws elbv2 describe-target-health \
  --target-group-arn <your-target-group-arn>
```

## Cost Estimate

With this setup, expect monthly costs of:
- RDS: ~$120-150 (db.t3.medium, Multi-AZ)
- EC2: ~$60-120 (2x t3.medium)
- ALB: ~$20-30
- S3: ~$5-10
- Other: ~$20-30

**Total: ~$225-340/month**

To reduce costs:
- Use smaller instances for dev/staging
- Use Single-AZ RDS for non-production
- Use Reserved Instances (save up to 72%)

## Getting Help

- **Detailed Guide**: See `AWS_DEPLOYMENT_GUIDE.md`
- **Checklist**: See `DEPLOYMENT_CHECKLIST.md`
- **Infrastructure**: See `terraform/README.md`
- **AWS Support**: https://console.aws.amazon.com/support/

## Important URLs

After deployment, bookmark these:

- **Application**: https://yourdomain.com
- **AWS Console**: https://console.aws.amazon.com
- **CloudWatch Logs**: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups
- **RDS Console**: https://console.aws.amazon.com/rds/home?region=us-east-1
- **S3 Console**: https://s3.console.aws.amazon.com/s3/home?region=us-east-1

---

**Need more details?** Check out the comprehensive deployment guide: `AWS_DEPLOYMENT_GUIDE.md`
