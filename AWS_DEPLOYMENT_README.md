# AWS Deployment Package for Ambersand

Complete deployment package for deploying the Ambersand Compliance Management System to Amazon AWS.

## 📋 What's Included

This deployment package contains everything you need to deploy Ambersand to AWS:

### Documentation
- **AWS_DEPLOYMENT_GUIDE.md** - Comprehensive step-by-step deployment guide
- **QUICK_START_AWS.md** - Fast-track deployment (30-45 minutes)
- **DEPLOYMENT_CHECKLIST.md** - Complete checklist for successful deployment
- **AWS_DEPLOYMENT_README.md** - This file

### Infrastructure as Code
- **terraform/** - Complete Terraform configuration
  - VPC with public/private subnets
  - RDS PostgreSQL database
  - S3 bucket for file storage
  - Application Load Balancer with HTTPS
  - Auto Scaling Group with EC2 instances
  - Security groups and IAM roles
  - CloudWatch monitoring

### Containerization
- **Dockerfile** - Production-ready Docker image
- **docker-compose.yml** - Local development with Docker
- **docker-compose.prod.yml** - Production deployment to ECS
- **.dockerignore** - Optimized Docker builds
- **nginx.conf** - Nginx reverse proxy configuration

### CI/CD Pipelines
- **.github/workflows/ci.yml** - Continuous Integration
- **.github/workflows/deploy-aws.yml** - Continuous Deployment to AWS

### Deployment Scripts
- **scripts/aws/deploy-to-ec2.sh** - Automated EC2 deployment
- **scripts/aws/migrate-database.sh** - Database migration for RDS
- **scripts/aws/backup-rds.sh** - RDS backup automation

### Configuration Templates
- **.env.production.example** - Production environment variables
- **.env.staging.example** - Staging environment variables

## 🚀 Quick Start

Choose your deployment path:

### Option 1: Fast Track (30-45 minutes)
Follow **QUICK_START_AWS.md** for rapid deployment using Terraform.

### Option 2: Detailed Deployment
Follow **AWS_DEPLOYMENT_GUIDE.md** for comprehensive step-by-step instructions.

### Option 3: Manual Setup
Use the deployment guide as a reference and set up infrastructure manually via AWS Console.

## 📊 Architecture Overview

```
Internet
   │
   ├─→ Route 53 (DNS)
   │
   ├─→ Application Load Balancer (HTTPS)
   │   └─→ Target Group
   │       ├─→ EC2 Instance 1 (Private Subnet)
   │       └─→ EC2 Instance 2 (Private Subnet)
   │
   ├─→ RDS PostgreSQL (Multi-AZ, Private Subnet)
   │
   └─→ S3 Bucket (File Storage)
```

## 💰 Cost Estimation

### Production Environment (~$225-340/month)
- RDS PostgreSQL (db.t3.medium, Multi-AZ): $120-150
- EC2 (2x t3.medium): $60-120
- Application Load Balancer: $20-30
- S3 Storage: $5-10
- Data Transfer & Other: $20-30

### Development Environment (~$80-120/month)
- RDS PostgreSQL (db.t3.small, Single-AZ): $30-40
- EC2 (1x t3.small): $15-30
- Application Load Balancer: $20-30
- S3 Storage: $5-10
- Data Transfer & Other: $10-20

**Cost Savings Tips:**
- Use Reserved Instances (save up to 72%)
- Use Spot Instances for non-critical workloads
- Enable RDS auto-pause for dev/staging
- Use S3 Intelligent-Tiering

## 🏗️ Deployment Options

### 1. EC2 with Auto Scaling (Recommended)
- **Best for**: Most use cases, full control
- **Pros**: Simple, flexible, cost-effective
- **Cons**: Requires more management
- **Use Terraform**: `terraform/`
- **Deploy**: `scripts/aws/deploy-to-ec2.sh`

### 2. ECS with Fargate
- **Best for**: Microservices, container-first
- **Pros**: Fully managed, auto-scaling
- **Cons**: Higher cost, less control
- **Use Docker**: `docker-compose.prod.yml`

### 3. Elastic Beanstalk
- **Best for**: Quick deployment, minimal DevOps
- **Pros**: Easiest to deploy
- **Cons**: Less flexibility
- **Deploy**: Upload Dockerfile

## 📁 File Structure

```
.
├── AWS_DEPLOYMENT_GUIDE.md         # Comprehensive deployment guide
├── QUICK_START_AWS.md              # Quick start guide
├── DEPLOYMENT_CHECKLIST.md         # Deployment checklist
├── Dockerfile                      # Docker image definition
├── docker-compose.yml              # Local development
├── docker-compose.prod.yml         # Production Docker setup
├── nginx.conf                      # Nginx configuration
├── .dockerignore                   # Docker build optimization
├── .env.production.example         # Production env template
├── .env.staging.example            # Staging env template
│
├── terraform/                      # Infrastructure as Code
│   ├── main.tf                     # Main Terraform config
│   ├── variables.tf                # Input variables
│   ├── outputs.tf                  # Output values
│   ├── terraform.tfvars.example    # Configuration template
│   ├── README.md                   # Terraform documentation
│   └── modules/                    # Terraform modules
│       ├── vpc/                    # VPC and networking
│       ├── security_groups/        # Security groups
│       ├── database/               # RDS PostgreSQL
│       ├── storage/                # S3 bucket
│       ├── alb/                    # Load balancer
│       ├── compute/                # EC2 Auto Scaling
│       ├── dns/                    # Route 53
│       └── monitoring/             # CloudWatch
│
├── .github/workflows/              # CI/CD pipelines
│   ├── ci.yml                      # Continuous Integration
│   └── deploy-aws.yml              # Continuous Deployment
│
└── scripts/aws/                    # Deployment scripts
    ├── deploy-to-ec2.sh            # EC2 deployment
    ├── migrate-database.sh         # Database migrations
    └── backup-rds.sh               # Database backups
```

## 🔧 Prerequisites

### Required
- AWS account with billing enabled
- AWS CLI installed and configured
- Terraform 1.0+ (for IaC deployment)
- Node.js 20+ (for local testing)
- Git (for version control)

### Recommended
- Domain name
- SendGrid account (for emails)
- Basic AWS knowledge
- Terraform experience (helpful but not required)

## 📖 Step-by-Step Deployment

### 1. Preparation (10 minutes)
```bash
# Install prerequisites
brew install awscli terraform  # macOS
# or use package manager for your OS

# Configure AWS CLI
aws configure

# Generate secrets
openssl rand -hex 64  # JWT access secret
openssl rand -hex 64  # JWT refresh secret
openssl rand -hex 32  # Session secret
```

### 2. Infrastructure Setup (20 minutes)
```bash
# Using Terraform (recommended)
cd terraform
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars  # Update with your values
terraform init
terraform plan
terraform apply
```

### 3. Database Migration (5 minutes)
```bash
# Connect to EC2 instance
aws ssm start-session --target <instance-id>

# Run migrations
cd /opt/ambersand
npm run db:push
npm run migrate:ecc
```

### 4. Application Deployment (5 minutes)
```bash
# On EC2 instance
./scripts/aws/deploy-to-ec2.sh

# Or use CI/CD pipeline
git push origin main
```

### 5. DNS Configuration (5 minutes)
```bash
# Point your domain to the ALB
# Get ALB DNS name:
terraform output alb_dns_name

# Create CNAME or A record in your DNS provider
```

### 6. Testing (10 minutes)
```bash
# Test health endpoint
curl https://yourdomain.com/healthz

# Test application
open https://yourdomain.com
```

## 🔐 Security Best Practices

### Pre-Deployment
- [ ] Enable MFA on AWS root account
- [ ] Use IAM roles instead of access keys
- [ ] Generate strong secrets (64+ characters)
- [ ] Never commit secrets to Git

### Infrastructure
- [ ] Use private subnets for application and database
- [ ] Configure security groups with least privilege
- [ ] Enable encryption at rest (RDS, S3)
- [ ] Enable encryption in transit (SSL/TLS)
- [ ] Use AWS Secrets Manager for production secrets

### Application
- [ ] Keep dependencies up to date
- [ ] Enable CloudWatch logging
- [ ] Configure rate limiting
- [ ] Implement CORS properly
- [ ] Use parameterized queries (Drizzle ORM)

### Monitoring
- [ ] Enable CloudTrail for audit logging
- [ ] Configure CloudWatch alarms
- [ ] Set up AWS Config for compliance
- [ ] Enable GuardDuty for threat detection

## 🚨 Troubleshooting

### Application won't start
```bash
# Check PM2 logs
pm2 logs ambersand

# Check environment variables
pm2 env 0

# Restart application
pm2 restart ambersand
```

### Database connection fails
```bash
# Test connection
psql "$DATABASE_URL"

# Check security groups
aws ec2 describe-security-groups --group-ids <sg-id>

# Verify RDS is running
aws rds describe-db-instances --db-instance-identifier ambersand-db
```

### Load balancer shows unhealthy
```bash
# Check target health
aws elbv2 describe-target-health --target-group-arn <tg-arn>

# Check health endpoint locally
curl http://localhost:5000/healthz

# Check application logs
pm2 logs ambersand
```

### High costs
```bash
# Review costs
aws ce get-cost-and-usage --time-period Start=2025-01-01,End=2025-01-31 --granularity MONTHLY --metrics BlendedCost

# Identify expensive resources
# 1. Check EC2 instance sizes
# 2. Review RDS instance class
# 3. Check data transfer costs
# 4. Look for unused resources
```

## 📚 Additional Resources

### AWS Documentation
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [RDS Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html)
- [EC2 Best Practices](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-best-practices.html)

### Terraform
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Terraform Best Practices](https://www.terraform-best-practices.com/)

### Application
- [Node.js Production Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)

## 🤝 Support

- **GitHub Issues**: Report bugs and issues
- **AWS Support**: https://console.aws.amazon.com/support/
- **Terraform Forum**: https://discuss.hashicorp.com/

## 📝 Maintenance

### Daily
- Review CloudWatch metrics
- Check application logs
- Verify backup completion

### Weekly
- Review RDS performance
- Check disk space
- Update security patches

### Monthly
- Review and optimize costs
- Rotate secrets and keys
- Test disaster recovery
- Update documentation

### Quarterly
- Security audit
- Load testing
- Review scaling policies
- Update SSL certificates

## 🎯 Success Checklist

Your deployment is successful when:

✅ Application accessible via HTTPS
✅ All features working correctly
✅ Health checks passing
✅ Monitoring active
✅ Backups configured
✅ CI/CD pipeline working
✅ No errors in logs
✅ SSL certificate valid
✅ Database performing well
✅ Costs within budget

## 📞 Getting Help

1. **Check Documentation**: Review the deployment guide and checklist
2. **Check Logs**: PM2, CloudWatch, Nginx logs
3. **AWS Support**: Use AWS support console
4. **Community**: Terraform forums, AWS forums

## 🎉 Congratulations!

You now have everything you need to deploy Ambersand to AWS. Choose your deployment path and follow the guide.

**Recommended Next Steps:**
1. Read QUICK_START_AWS.md for fastest deployment
2. Review DEPLOYMENT_CHECKLIST.md for comprehensive coverage
3. Set up CI/CD pipeline for automated deployments
4. Configure monitoring and alerts
5. Test your deployment thoroughly

Good luck with your deployment! 🚀
