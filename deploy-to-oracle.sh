#!/bin/bash

# Automated deployment script for Oracle Cloud Infrastructure
# This script uploads and deploys your server to OCI

set -e

# Configuration
SERVER_USER="ubuntu"
SERVER_HOST=""  # Will be provided as argument
PRIVATE_KEY=""  # Will be provided as argument
APP_DIR="/var/www/perplexity-scene-server"
LOCAL_SERVER_DIR="./server"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--host)
            SERVER_HOST="$2"
            shift 2
            ;;
        -k|--key)
            PRIVATE_KEY="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 -h <server-host> -k <private-key-path>"
            echo "  -h, --host    Server hostname or IP address"
            echo "  -k, --key     Path to SSH private key"
            exit 0
            ;;
        *)
            log_error "Unknown option $1"
            exit 1
            ;;
    esac
done

# Validate required arguments
if [[ -z "$SERVER_HOST" ]]; then
    log_error "Server host is required. Use -h or --host"
    exit 1
fi

if [[ -z "$PRIVATE_KEY" ]]; then
    log_error "Private key path is required. Use -k or --key"
    exit 1
fi

if [[ ! -f "$PRIVATE_KEY" ]]; then
    log_error "Private key file not found: $PRIVATE_KEY"
    exit 1
fi

if [[ ! -d "$LOCAL_SERVER_DIR" ]]; then
    log_error "Local server directory not found: $LOCAL_SERVER_DIR"
    exit 1
fi

log_info "Starting deployment to $SERVER_HOST"

# Step 1: Build the server locally
log_info "Building server locally..."
cd "$LOCAL_SERVER_DIR"
npm install
npm run build
cd ..

# Step 2: Create deployment archive
log_info "Creating deployment archive..."
tar -czf server-deploy.tar.gz -C "$LOCAL_SERVER_DIR" \
    dist/ \
    package.json \
    package-lock.json \
    ecosystem.config.js \
    .env.production \
    config/ \
    --exclude=node_modules \
    --exclude=.env

# Step 3: Upload files to server
log_info "Uploading files to server..."
scp -i "$PRIVATE_KEY" -o StrictHostKeyChecking=no \
    server-deploy.tar.gz \
    "$SERVER_USER@$SERVER_HOST:/tmp/"

scp -i "$PRIVATE_KEY" -o StrictHostKeyChecking=no \
    deploy-oracle-cloud.sh \
    "$SERVER_USER@$SERVER_HOST:/tmp/"

# Step 4: Execute deployment on server
log_info "Executing deployment on server..."
ssh -i "$PRIVATE_KEY" -o StrictHostKeyChecking=no \
    "$SERVER_USER@$SERVER_HOST" << 'ENDSSH'
set -e

# Make deployment script executable
chmod +x /tmp/deploy-oracle-cloud.sh

# Run initial setup if not already done
if [[ ! -d "/var/www/perplexity-scene-server" ]]; then
    echo "Running initial server setup..."
    /tmp/deploy-oracle-cloud.sh
fi

# Extract new deployment
echo "Extracting deployment files..."
cd /var/www/perplexity-scene-server/server
tar -xzf /tmp/server-deploy.tar.gz

# Install production dependencies
echo "Installing production dependencies..."
npm ci --only=production

# Copy production environment file
if [[ -f ".env.production" && ! -f ".env" ]]; then
    echo "Setting up production environment..."
    cp .env.production .env
    echo "⚠️  Please edit .env file with your actual OCI credentials"
fi

# Restart application
echo "Restarting application..."
pm2 restart perplexity-scene-server || pm2 start ecosystem.config.js
pm2 save

# Clean up
rm -f /tmp/server-deploy.tar.gz /tmp/deploy-oracle-cloud.sh

echo "✅ Deployment completed successfully!"
echo "📋 Don't forget to:"
echo "   1. Edit /var/www/perplexity-scene-server/server/.env with your OCI credentials"
echo "   2. Check application status: pm2 status"
echo "   3. View logs: pm2 logs perplexity-scene-server"
ENDSSH

# Step 5: Cleanup local files
log_info "Cleaning up local files..."
rm -f server-deploy.tar.gz

# Step 6: Show status
log_info "Checking deployment status..."
ssh -i "$PRIVATE_KEY" -o StrictHostKeyChecking=no \
    "$SERVER_USER@$SERVER_HOST" "pm2 status && echo '' && curl -f http://localhost:3000/health"

log_success "Deployment completed successfully!"
log_info "Your server is running at: http://$SERVER_HOST"
log_warning "Remember to configure your .env file with actual OCI credentials"

echo ""
echo "🔗 Quick commands for server management:"
echo "   Connect: ssh -i \"$PRIVATE_KEY\" $SERVER_USER@$SERVER_HOST"
echo "   Status:  pm2 status"
echo "   Logs:    pm2 logs perplexity-scene-server"
echo "   Restart: pm2 restart perplexity-scene-server"
