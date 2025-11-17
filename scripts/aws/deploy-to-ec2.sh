#!/bin/bash
# Deployment script for AWS EC2 instances

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Configuration
APP_DIR="/opt/ambersand"
APP_NAME="ambersand"
GITHUB_REPO="${GITHUB_REPO:-}"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"

print_info "═══════════════════════════════════════════════════"
print_info "Ambersand Deployment Script for AWS EC2"
print_info "═══════════════════════════════════════════════════"

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    print_error "This script must be run as root or with sudo"
    exit 1
fi

# Step 1: Update system packages
print_step "1/10 - Updating system packages..."
apt-get update
apt-get upgrade -y

# Step 2: Install Node.js 20
print_step "2/10 - Installing Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    print_info "✓ Node.js installed: $(node --version)"
else
    print_info "✓ Node.js already installed: $(node --version)"
fi

# Step 3: Install PM2
print_step "3/10 - Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
    print_info "✓ PM2 installed"
else
    print_info "✓ PM2 already installed"
fi

# Step 4: Install other dependencies
print_step "4/10 - Installing system dependencies..."
apt-get install -y git postgresql-client nginx

# Step 5: Create application directory
print_step "5/10 - Setting up application directory..."
mkdir -p $APP_DIR
cd $APP_DIR

# Step 6: Clone or pull repository
print_step "6/10 - Deploying application code..."
if [ -d ".git" ]; then
    print_info "Repository exists, pulling latest changes..."
    git fetch origin
    git checkout $GITHUB_BRANCH
    git pull origin $GITHUB_BRANCH
else
    if [ -z "$GITHUB_REPO" ]; then
        print_error "GITHUB_REPO environment variable is not set"
        print_info "Please set GITHUB_REPO to your repository URL"
        exit 1
    fi
    print_info "Cloning repository..."
    git clone -b $GITHUB_BRANCH $GITHUB_REPO .
fi

# Step 7: Install dependencies
print_step "7/10 - Installing application dependencies..."
npm ci --omit=dev

# Step 8: Build application
print_step "8/10 - Building application..."
npm run build

# Step 9: Set up environment variables
print_step "9/10 - Setting up environment variables..."
if [ ! -f ".env" ]; then
    print_warning ".env file not found"
    print_info "Creating .env file from template..."

    cat > .env << EOF
# Database
DATABASE_URL=${DATABASE_URL:-postgresql://user:pass@localhost:5432/ambersand}

# Application
NODE_ENV=production
PORT=5000
APP_BASE_URL=${APP_BASE_URL:-http://localhost:5000}

# JWT Secrets
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET:-}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET:-}
SESSION_SECRET=${SESSION_SECRET:-}

# Email Configuration
EMAIL_DRIVER=${EMAIL_DRIVER:-sendgrid}
SENDGRID_API_KEY=${SENDGRID_API_KEY:-}
SENDGRID_FROM_EMAIL=${SENDGRID_FROM_EMAIL:-no-reply@example.com}
SENDGRID_FROM_NAME=${SENDGRID_FROM_NAME:-Ambersand}

# AWS Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_S3_BUCKET=${AWS_S3_BUCKET:-}
EOF

    chmod 600 .env
    print_warning "Please update .env file with your actual values!"
else
    print_info "✓ .env file already exists"
fi

# Step 10: Start application with PM2
print_step "10/10 - Starting application..."

# Check if PM2 is already running the app
if pm2 describe $APP_NAME > /dev/null 2>&1; then
    print_info "Reloading existing PM2 process..."
    pm2 reload $APP_NAME --update-env
else
    print_info "Starting new PM2 process..."
    pm2 start dist/index.js --name $APP_NAME
    pm2 startup
    pm2 save
fi

# Configure PM2 log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# Step 11: Configure Nginx (if not already configured)
print_info "Configuring Nginx..."
if [ ! -f "/etc/nginx/sites-available/$APP_NAME" ]; then
    cat > /etc/nginx/sites-available/$APP_NAME << 'EOF'
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
        client_max_body_size 50M;
    }

    location /healthz {
        proxy_pass http://localhost:5000/healthz;
        access_log off;
    }
}
EOF

    ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default

    nginx -t && systemctl restart nginx
    print_info "✓ Nginx configured and restarted"
else
    print_info "✓ Nginx already configured"
fi

# Display status
print_info "═══════════════════════════════════════════════════"
print_info "Deployment completed successfully!"
print_info "═══════════════════════════════════════════════════"

echo ""
print_info "Application Status:"
pm2 status

echo ""
print_info "Application Logs:"
print_info "  View logs: pm2 logs $APP_NAME"
print_info "  Monitor: pm2 monit"
print_info "  Restart: pm2 restart $APP_NAME"
print_info "  Stop: pm2 stop $APP_NAME"

echo ""
print_info "Next Steps:"
echo "  1. Update .env file with production values"
echo "  2. Run database migrations: npm run db:push"
echo "  3. Test the application: curl http://localhost:5000/healthz"
echo "  4. Configure SSL with Let's Encrypt (optional)"
echo ""

print_info "SSL Setup (optional):"
echo "  sudo apt install certbot python3-certbot-nginx"
echo "  sudo certbot --nginx -d yourdomain.com"
echo ""
