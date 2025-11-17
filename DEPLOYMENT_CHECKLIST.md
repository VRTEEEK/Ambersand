# AWS Deployment Checklist for Ambersand

Use this checklist to ensure a complete and successful AWS deployment.

## Pre-Deployment Checklist

### AWS Account Setup
- [ ] AWS account created and verified
- [ ] Billing alerts configured
- [ ] AWS CLI installed and configured
- [ ] IAM user created with appropriate permissions
- [ ] MFA enabled on root account and IAM users
- [ ] AWS region selected (default: us-east-1)

### Domain and SSL
- [ ] Domain name registered
- [ ] Domain nameservers accessible
- [ ] ACM certificate requested for domain
- [ ] Certificate validated (DNS or email)

### Secrets and Keys
- [ ] Generated JWT access secret (64+ chars): `openssl rand -hex 64`
- [ ] Generated JWT refresh secret (64+ chars): `openssl rand -hex 64`
- [ ] Generated session secret (32+ chars): `openssl rand -hex 32`
- [ ] SendGrid account created
- [ ] SendGrid API key generated
- [ ] SendGrid sender identity verified
- [ ] Database password generated (strong, 20+ chars)

### Code Repository
- [ ] Code pushed to GitHub/GitLab
- [ ] .gitignore configured correctly
- [ ] No secrets committed to repository
- [ ] README updated with deployment info

## Infrastructure Deployment Checklist

### Option A: Using Terraform

- [ ] Terraform installed (version 1.0+)
- [ ] Copied `terraform/terraform.tfvars.example` to `terraform/terraform.tfvars`
- [ ] Updated all variables in `terraform.tfvars`
- [ ] Created EC2 key pair
- [ ] Validated Terraform configuration: `terraform validate`
- [ ] Reviewed infrastructure plan: `terraform plan`
- [ ] Applied infrastructure: `terraform apply`
- [ ] Saved Terraform outputs
- [ ] Documented infrastructure details

### Option B: Manual AWS Console Setup

#### VPC and Networking
- [ ] Created VPC (10.0.0.0/16)
- [ ] Created public subnets (2 AZs)
- [ ] Created private subnets (2 AZs)
- [ ] Created Internet Gateway
- [ ] Created NAT Gateway (or NAT instance for cost savings)
- [ ] Configured route tables

#### Security Groups
- [ ] Created ALB security group (ports 80, 443)
- [ ] Created application security group (port 5000 from ALB)
- [ ] Created RDS security group (port 5432 from app)

#### RDS Database
- [ ] Created RDS PostgreSQL 16 instance
- [ ] Configured Multi-AZ (production)
- [ ] Set up automated backups (7-day retention)
- [ ] Configured database subnet group
- [ ] Enabled encryption at rest
- [ ] Recorded connection endpoint
- [ ] Tested database connectivity

#### S3 Storage
- [ ] Created S3 bucket for uploads
- [ ] Enabled versioning
- [ ] Enabled encryption (AES-256)
- [ ] Blocked public access
- [ ] Created IAM policy for S3 access
- [ ] Configured lifecycle policies (optional)

#### Application Load Balancer
- [ ] Created target group (HTTP, port 80)
- [ ] Configured health check (/healthz)
- [ ] Created Application Load Balancer
- [ ] Added HTTPS listener (port 443) with ACM certificate
- [ ] Added HTTP to HTTPS redirect (port 80)
- [ ] Configured stickiness (if needed)

#### EC2 Auto Scaling
- [ ] Created IAM instance role
- [ ] Attached S3 and CloudWatch policies to role
- [ ] Created launch template
- [ ] Configured user data script
- [ ] Created Auto Scaling group (min: 1, desired: 2, max: 4)
- [ ] Registered targets with ALB
- [ ] Configured scaling policies

#### DNS (Route 53)
- [ ] Created hosted zone (if using Route 53)
- [ ] Created A record (alias to ALB)
- [ ] Updated nameservers at registrar
- [ ] Verified DNS propagation

## Application Deployment Checklist

### Initial Deployment

- [ ] SSH access to EC2 instance verified
- [ ] Copied deployment script to instance
- [ ] Ran deployment script: `./scripts/aws/deploy-to-ec2.sh`
- [ ] Created `.env` file with production values
- [ ] Set correct file permissions: `chmod 600 .env`
- [ ] Installed Node.js 20
- [ ] Installed PM2 globally
- [ ] Cloned repository
- [ ] Ran `npm ci --omit=dev`
- [ ] Built application: `npm run build`
- [ ] Verified build output exists

### Database Setup

- [ ] Set DATABASE_URL environment variable
- [ ] Ran schema migrations: `npm run db:push`
- [ ] Ran ECC migrations: `npm run migrate:ecc`
- [ ] Imported regulations (if needed)
- [ ] Verified tables created correctly
- [ ] Created initial admin user (if needed)

### Application Startup

- [ ] Started application with PM2: `pm2 start dist/index.js --name ambersand`
- [ ] Configured PM2 startup: `pm2 startup` and `pm2 save`
- [ ] Installed PM2 log rotation: `pm2 install pm2-logrotate`
- [ ] Verified application is running: `pm2 status`
- [ ] Checked application logs: `pm2 logs ambersand`
- [ ] Tested health endpoint: `curl http://localhost:5000/healthz`

### Nginx Setup

- [ ] Installed Nginx
- [ ] Configured Nginx as reverse proxy
- [ ] Enabled Nginx configuration
- [ ] Tested Nginx configuration: `nginx -t`
- [ ] Restarted Nginx: `systemctl restart nginx`
- [ ] Verified Nginx is running

### SSL Configuration

- [ ] Verified HTTPS is working via ALB
- [ ] Tested HTTP to HTTPS redirect
- [ ] Checked SSL certificate is valid
- [ ] Verified all assets loading over HTTPS

## Post-Deployment Checklist

### Testing and Verification

- [ ] Accessed application via domain URL
- [ ] Tested user registration
- [ ] Tested user login
- [ ] Tested password reset flow
- [ ] Tested file upload functionality
- [ ] Tested compliance assessment features
- [ ] Tested email notifications
- [ ] Tested report generation (PDF, DOCX, Excel)
- [ ] Tested mobile responsiveness
- [ ] Tested Arabic/English language switching
- [ ] Verified all API endpoints working

### Monitoring Setup

- [ ] Configured CloudWatch Logs
- [ ] Set up CloudWatch alarms:
  - [ ] High CPU utilization (>80%)
  - [ ] High memory utilization (>80%)
  - [ ] Unhealthy target count (>0)
  - [ ] RDS high CPU (>80%)
  - [ ] RDS low storage space (<20%)
  - [ ] Application errors (4xx, 5xx)
- [ ] Created CloudWatch dashboard
- [ ] Configured SNS topic for alerts
- [ ] Added email subscriptions for alerts

### Backup Configuration

- [ ] Verified RDS automated backups enabled
- [ ] Tested manual RDS snapshot creation
- [ ] Configured S3 bucket lifecycle policies
- [ ] Set up cross-region replication (optional)
- [ ] Documented backup procedures
- [ ] Tested database restore procedure

### Security Hardening

- [ ] Reviewed security group rules (least privilege)
- [ ] Enabled AWS GuardDuty
- [ ] Enabled AWS Config
- [ ] Enabled CloudTrail for audit logging
- [ ] Configured VPC Flow Logs
- [ ] Disabled root SSH access on EC2
- [ ] Configured fail2ban (optional)
- [ ] Set up AWS WAF (optional but recommended)
- [ ] Enabled AWS Shield (basic is free)
- [ ] Reviewed IAM policies
- [ ] Rotated all secrets and access keys

### Performance Optimization

- [ ] Configured CloudFront CDN (optional)
- [ ] Optimized database queries
- [ ] Configured database connection pooling
- [ ] Enabled Gzip compression in Nginx
- [ ] Set up browser caching headers
- [ ] Optimized images and static assets
- [ ] Configured Auto Scaling policies
- [ ] Load tested application

### Documentation

- [ ] Documented infrastructure architecture
- [ ] Documented deployment process
- [ ] Documented rollback procedures
- [ ] Documented database schema
- [ ] Documented API endpoints
- [ ] Created runbook for common issues
- [ ] Updated README with production info
- [ ] Documented monitoring and alerting

## CI/CD Setup Checklist

### GitHub Actions

- [ ] Created GitHub repository secrets:
  - [ ] AWS_ACCESS_KEY_ID
  - [ ] AWS_SECRET_ACCESS_KEY
  - [ ] DEPLOYMENT_BUCKET
- [ ] Created GitHub repository variables:
  - [ ] APP_URL
  - [ ] AWS_REGION
- [ ] Enabled GitHub Actions
- [ ] Tested CI workflow (test and build)
- [ ] Tested CD workflow (deploy)
- [ ] Verified automated deployments working
- [ ] Set up branch protection rules
- [ ] Configured deployment approvals (optional)

## Maintenance Checklist

### Regular Tasks

Daily:
- [ ] Review CloudWatch metrics
- [ ] Check application logs for errors
- [ ] Verify backup completion

Weekly:
- [ ] Review and optimize RDS performance
- [ ] Check disk space usage
- [ ] Review security logs
- [ ] Update dependencies (security patches)

Monthly:
- [ ] Review AWS costs and optimize
- [ ] Rotate access keys and secrets
- [ ] Test disaster recovery procedures
- [ ] Review and update documentation
- [ ] Audit user access and permissions

Quarterly:
- [ ] Perform security audit
- [ ] Review and update backup retention policies
- [ ] Load test application
- [ ] Review and optimize Auto Scaling policies
- [ ] Update SSL certificates (if needed)

## Troubleshooting Checklist

If something goes wrong:

- [ ] Check PM2 logs: `pm2 logs ambersand`
- [ ] Check Nginx logs: `tail -f /var/log/nginx/error.log`
- [ ] Check CloudWatch Logs
- [ ] Verify environment variables are set correctly
- [ ] Test database connectivity: `psql $DATABASE_URL`
- [ ] Check disk space: `df -h`
- [ ] Check memory usage: `free -m`
- [ ] Verify security group rules
- [ ] Check ALB target health
- [ ] Review recent deployments
- [ ] Check for recent AWS service issues

## Rollback Procedures

If deployment fails:

1. [ ] Stop current deployment
2. [ ] Access EC2 instance
3. [ ] Checkout previous working commit: `git checkout <previous-commit>`
4. [ ] Rebuild application: `npm ci && npm run build`
5. [ ] Restart PM2: `pm2 restart ambersand`
6. [ ] Verify application is working
7. [ ] Investigate and document issue
8. [ ] Create hotfix if needed

## Cost Optimization Checklist

- [ ] Right-sized EC2 instances
- [ ] Considered Reserved Instances (up to 72% savings)
- [ ] Reviewed and optimized RDS instance class
- [ ] Configured RDS auto-pause for dev/staging
- [ ] Implemented S3 Intelligent-Tiering
- [ ] Set up S3 lifecycle policies
- [ ] Configured ALB idle timeout
- [ ] Reviewed data transfer costs
- [ ] Deleted unused EBS snapshots
- [ ] Deleted unused AMIs
- [ ] Set up AWS Budgets and alerts

## Compliance and Audit Checklist

- [ ] HTTPS enforced everywhere
- [ ] Data encryption at rest (RDS, S3)
- [ ] Data encryption in transit (SSL/TLS)
- [ ] Audit logging enabled (CloudTrail)
- [ ] Access logs configured
- [ ] Password policies enforced
- [ ] Session timeout configured
- [ ] CORS properly configured
- [ ] Rate limiting implemented
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (using ORM)
- [ ] XSS prevention implemented
- [ ] CSRF protection enabled

## Launch Day Checklist

Final checks before going live:

- [ ] All previous checklist items completed
- [ ] Load testing completed successfully
- [ ] Security scan completed (no critical issues)
- [ ] Database backups verified
- [ ] Monitoring and alerts working
- [ ] Support team trained
- [ ] Documentation up to date
- [ ] Rollback plan documented and tested
- [ ] Communication plan ready
- [ ] Performance benchmarks established
- [ ] All stakeholders notified

---

## Success Criteria

Your deployment is successful when:

✅ Application is accessible via HTTPS domain
✅ All features working correctly
✅ Health checks passing
✅ Monitoring showing normal metrics
✅ Backups running automatically
✅ Email notifications working
✅ File uploads to S3 working
✅ Database queries performing well
✅ No errors in logs
✅ CI/CD pipeline functional

---

**Congratulations! Your Ambersand application is now running on AWS!** 🎉
