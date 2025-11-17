#!/bin/bash
# RDS Database Backup Script

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Configuration
DB_INSTANCE_ID="${DB_INSTANCE_ID:-ambersand-db}"
AWS_REGION="${AWS_REGION:-us-east-1}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
SNAPSHOT_PREFIX="ambersand-manual-backup"

print_info "═══════════════════════════════════════════════════"
print_info "RDS Database Backup Script"
print_info "═══════════════════════════════════════════════════"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    print_error "AWS credentials not configured"
    exit 1
fi

# Create manual snapshot
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
SNAPSHOT_ID="${SNAPSHOT_PREFIX}-${TIMESTAMP}"

print_info "Creating manual snapshot: $SNAPSHOT_ID"
aws rds create-db-snapshot \
    --db-instance-identifier $DB_INSTANCE_ID \
    --db-snapshot-identifier $SNAPSHOT_ID \
    --region $AWS_REGION

if [ $? -eq 0 ]; then
    print_info "✓ Snapshot creation initiated"
else
    print_error "Failed to create snapshot"
    exit 1
fi

# Wait for snapshot to complete
print_info "Waiting for snapshot to complete..."
aws rds wait db-snapshot-completed \
    --db-snapshot-identifier $SNAPSHOT_ID \
    --region $AWS_REGION

print_info "✓ Snapshot completed successfully"

# List all manual snapshots
print_info "All manual snapshots:"
aws rds describe-db-snapshots \
    --db-instance-identifier $DB_INSTANCE_ID \
    --snapshot-type manual \
    --query "DBSnapshots[*].[DBSnapshotIdentifier,SnapshotCreateTime,Status,AllocatedStorage]" \
    --output table \
    --region $AWS_REGION

# Clean up old snapshots (optional)
print_info "Checking for old snapshots to delete..."

# Get snapshots older than retention period
OLD_SNAPSHOTS=$(aws rds describe-db-snapshots \
    --db-instance-identifier $DB_INSTANCE_ID \
    --snapshot-type manual \
    --query "DBSnapshots[?starts_with(DBSnapshotIdentifier, '$SNAPSHOT_PREFIX')].DBSnapshotIdentifier" \
    --output text \
    --region $AWS_REGION)

# Delete old snapshots
DELETED_COUNT=0
for SNAPSHOT in $OLD_SNAPSHOTS; do
    # Get snapshot creation time
    SNAPSHOT_TIME=$(aws rds describe-db-snapshots \
        --db-snapshot-identifier $SNAPSHOT \
        --query "DBSnapshots[0].SnapshotCreateTime" \
        --output text \
        --region $AWS_REGION)

    # Calculate age in days
    SNAPSHOT_EPOCH=$(date -d "$SNAPSHOT_TIME" +%s)
    CURRENT_EPOCH=$(date +%s)
    AGE_DAYS=$(( ($CURRENT_EPOCH - $SNAPSHOT_EPOCH) / 86400 ))

    if [ $AGE_DAYS -gt $BACKUP_RETENTION_DAYS ]; then
        print_warning "Deleting old snapshot: $SNAPSHOT (age: $AGE_DAYS days)"
        aws rds delete-db-snapshot \
            --db-snapshot-identifier $SNAPSHOT \
            --region $AWS_REGION
        DELETED_COUNT=$((DELETED_COUNT + 1))
    fi
done

if [ $DELETED_COUNT -gt 0 ]; then
    print_info "✓ Deleted $DELETED_COUNT old snapshots"
else
    print_info "No old snapshots to delete"
fi

# Export snapshot to S3 (optional)
read -p "Do you want to export this snapshot to S3? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter S3 bucket name: " S3_BUCKET
    read -p "Enter IAM role ARN for export: " IAM_ROLE_ARN

    EXPORT_ID="export-${TIMESTAMP}"

    print_info "Starting export to S3..."
    aws rds start-export-task \
        --export-task-identifier $EXPORT_ID \
        --source-arn $(aws rds describe-db-snapshots \
            --db-snapshot-identifier $SNAPSHOT_ID \
            --query "DBSnapshots[0].DBSnapshotArn" \
            --output text \
            --region $AWS_REGION) \
        --s3-bucket-name $S3_BUCKET \
        --s3-prefix "rds-backups/" \
        --iam-role-arn $IAM_ROLE_ARN \
        --kms-key-id alias/aws/rds \
        --region $AWS_REGION

    print_info "✓ Export initiated to s3://$S3_BUCKET/rds-backups/"
fi

print_info "═══════════════════════════════════════════════════"
print_info "Backup completed successfully!"
print_info "Snapshot ID: $SNAPSHOT_ID"
print_info "═══════════════════════════════════════════════════"

echo ""
print_info "To restore from this snapshot:"
echo "  aws rds restore-db-instance-from-db-snapshot \\"
echo "    --db-instance-identifier ambersand-db-restored \\"
echo "    --db-snapshot-identifier $SNAPSHOT_ID \\"
echo "    --region $AWS_REGION"
echo ""
