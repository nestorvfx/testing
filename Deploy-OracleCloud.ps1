# Oracle Cloud Server Deployment Script for PowerShell
# Run this after connecting to your Oracle Cloud instance

Write-Host "🚀 Starting Oracle Cloud Server Deployment..." -ForegroundColor Green

# This script should be run on the Oracle Cloud instance (Linux)
# Here's what you need to do:

Write-Host "📋 Deployment Steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Connect to your Oracle Cloud instance:" -ForegroundColor Yellow
Write-Host "   ssh -i `"path\to\your\private-key.key`" ubuntu@YOUR_INSTANCE_IP" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Once connected, run these commands:" -ForegroundColor Yellow
Write-Host ""

$commands = @"
# Download the deployment script
curl -o deploy-oracle-cloud.sh https://raw.githubusercontent.com/yourusername/PerplexitySceneCapture/main/deploy-oracle-cloud.sh

# Make it executable
chmod +x deploy-oracle-cloud.sh

# Run the deployment
./deploy-oracle-cloud.sh
"@

Write-Host $commands -ForegroundColor Gray
Write-Host ""
Write-Host "3. Upload your server files:" -ForegroundColor Yellow

$uploadCommands = @"
# From your local machine, upload server files
scp -i "path\to\your\private-key.key" -r .\server\ ubuntu@YOUR_INSTANCE_IP:/var/www/perplexity-scene-server/

# Or use git to clone your repository on the server
git clone https://github.com/yourusername/PerplexitySceneCapture.git /var/www/perplexity-scene-server
"@

Write-Host $uploadCommands -ForegroundColor Gray
Write-Host ""
Write-Host "4. Configure environment variables:" -ForegroundColor Yellow

$envCommands = @"
# On the server, create and edit .env file
cd /var/www/perplexity-scene-server/server
cp .env.example .env
nano .env

# Add your OCI credentials:
# OCI_TENANCY_ID=your_tenancy_id
# OCI_USER_ID=your_user_id
# OCI_FINGERPRINT=your_fingerprint
# OCI_PRIVATE_KEY_PATH=path_to_private_key
# OCI_REGION=your_region
"@

Write-Host $envCommands -ForegroundColor Gray
Write-Host ""
Write-Host "5. Start your application:" -ForegroundColor Yellow

$startCommands = @"
# Install dependencies and build
npm install
npm run build

# Start with PM2
pm2 start ecosystem.config.js
pm2 save

# Check status
pm2 status
pm2 logs
"@

Write-Host $startCommands -ForegroundColor Gray
Write-Host ""
Write-Host "✅ Your server will be ready at: http://YOUR_INSTANCE_IP" -ForegroundColor Green
