#!/bin/bash
# Database migration script for AWS RDS deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    print_error "DATABASE_URL environment variable is not set"
    echo "Usage: DATABASE_URL='postgresql://user:pass@host:5432/dbname' ./migrate-database.sh"
    exit 1
fi

print_info "Starting database migration for AWS RDS..."

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root directory."
    exit 1
fi

# Test database connection
print_info "Testing database connection..."
if command -v psql &> /dev/null; then
    if psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
        print_info "✓ Database connection successful"
    else
        print_error "Failed to connect to database"
        exit 1
    fi
else
    print_warning "psql not found, skipping connection test"
fi

# Run Drizzle migrations
print_info "Running Drizzle schema migrations..."
npm run db:push

if [ $? -eq 0 ]; then
    print_info "✓ Schema migrations completed successfully"
else
    print_error "Schema migrations failed"
    exit 1
fi

# Run custom ECC migrations
print_info "Running ECC control migrations..."
npm run migrate:ecc

if [ $? -eq 0 ]; then
    print_info "✓ ECC migrations completed successfully"
else
    print_error "ECC migrations failed"
    exit 1
fi

# Optional: Import additional regulations
read -p "Do you want to import additional regulations? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Importing regulations..."
    npm run import:regulation
fi

# Verify migrations
print_info "Verifying database schema..."
if command -v psql &> /dev/null; then
    TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'" 2>/dev/null | tr -d ' ')

    if [ "$TABLE_COUNT" -gt 0 ]; then
        print_info "✓ Found $TABLE_COUNT tables in database"

        # List all tables
        print_info "Database tables:"
        psql "$DATABASE_URL" -c "\dt" 2>/dev/null
    else
        print_warning "No tables found in database"
    fi
fi

print_info "═══════════════════════════════════════════════════"
print_info "Database migration completed successfully!"
print_info "═══════════════════════════════════════════════════"

# Print next steps
echo ""
print_info "Next steps:"
echo "  1. Verify the database schema matches your expectations"
echo "  2. Test the application connection to RDS"
echo "  3. Create a database backup"
echo "  4. Deploy your application"
echo ""
