# PowerShell Deployment Script for Oracle Cloud Infrastructure
# This script automates the deployment of your server to OCI

param(
    [Parameter(Mandatory=$true)]
    [string]$ServerHost,
    
    [Parameter(Mandatory=$true)]
    [string]$PrivateKeyPath,
    
    [string]$ServerUser = "ubuntu",
    [string]$AppDir = "/var/www/perplexity-scene-server",
    [string]$LocalServerDir = ".\server"
)

# Colors for output
$RED = "Red"
$GREEN = "Green" 
$YELLOW = "Yellow"
$BLUE = "Blue"

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $BLUE
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor $GREEN
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $YELLOW
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $RED
}

# Validate inputs
if (-not (Test-Path $PrivateKeyPath)) {
    Write-Error "Private key file not found: $PrivateKeyPath"
    exit 1
}

if (-not (Test-Path $LocalServerDir)) {
    Write-Error "Local server directory not found: $LocalServerDir"
    exit 1
}

Write-Info "Starting deployment to $ServerHost"

try {
    # Step 1: Build the server locally
    Write-Info "Building server locally..."
    Push-Location $LocalServerDir
    npm install
    npm run build
    Pop-Location

    # Step 2: Create deployment archive
    Write-Info "Creating deployment archive..."
    $compressionPath = Join-Path $LocalServerDir "server-deploy.zip"
    
    # Create temporary directory for deployment files
    $tempDir = New-TemporaryFile | ForEach-Object { Remove-Item $_; New-Item -ItemType Directory -Path $_ }
    
    # Copy necessary files
    Copy-Item "$LocalServerDir\dist" -Destination "$tempDir\dist" -Recurse
    Copy-Item "$LocalServerDir\package.json" -Destination "$tempDir\"
    Copy-Item "$LocalServerDir\package-lock.json" -Destination "$tempDir\" -ErrorAction SilentlyContinue
    Copy-Item "$LocalServerDir\ecosystem.config.js" -Destination "$tempDir\" -ErrorAction SilentlyContinue
    Copy-Item "$LocalServerDir\.env.production" -Destination "$tempDir\" -ErrorAction SilentlyContinue
    Copy-Item "$LocalServerDir\config" -Destination "$tempDir\config" -Recurse -ErrorAction SilentlyContinue
    
    # Create zip archive
    Compress-Archive -Path "$tempDir\*" -DestinationPath "server-deploy.zip" -Force
    
    # Cleanup temp directory
    Remove-Item $tempDir -Recurse -Force

    # Step 3: Upload files to server using SCP (requires OpenSSH or WSL)
    Write-Info "Uploading files to server..."
    
    # Check if we're on Windows and have WSL/OpenSSH available
    $scpCommand = if (Get-Command scp -ErrorAction SilentlyContinue) { "scp" } else { "wsl scp" }
    $sshCommand = if (Get-Command ssh -ErrorAction SilentlyContinue) { "ssh" } else { "wsl ssh" }
    
    & $scpCommand -i $PrivateKeyPath -o StrictHostKeyChecking=no server-deploy.zip "$ServerUser@$ServerHost:/tmp/"
    & $scpCommand -i $PrivateKeyPath -o StrictHostKeyChecking=no deploy-oracle-cloud.sh "$ServerUser@$ServerHost:/tmp/"

    # Step 4: Execute deployment on server
    Write-Info "Executing deployment on server..."
    
    $deploymentScript = @"
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
unzip -o /tmp/server-deploy.zip

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
rm -f /tmp/server-deploy.zip /tmp/deploy-oracle-cloud.sh

echo "✅ Deployment completed successfully!"
"@

    $deploymentScript | & $sshCommand -i $PrivateKeyPath -o StrictHostKeyChecking=no "$ServerUser@$ServerHost" bash

    # Step 5: Cleanup local files
    Write-Info "Cleaning up local files..."
    Remove-Item "server-deploy.zip" -ErrorAction SilentlyContinue

    # Step 6: Show status
    Write-Info "Checking deployment status..."
    & $sshCommand -i $PrivateKeyPath -o StrictHostKeyChecking=no "$ServerUser@$ServerHost" "pm2 status && echo '' && curl -f http://localhost:3000/health"

    Write-Success "Deployment completed successfully!"
    Write-Info "Your server is running at: http://$ServerHost"
    Write-Warning "Remember to configure your .env file with actual OCI credentials"

    Write-Host ""
    Write-Host "🔗 Quick commands for server management:" -ForegroundColor Cyan
    Write-Host "   Connect: ssh -i `"$PrivateKeyPath`" $ServerUser@$ServerHost" -ForegroundColor Gray
    Write-Host "   Status:  pm2 status" -ForegroundColor Gray
    Write-Host "   Logs:    pm2 logs perplexity-scene-server" -ForegroundColor Gray
    Write-Host "   Restart: pm2 restart perplexity-scene-server" -ForegroundColor Gray

} catch {
    Write-Error "Deployment failed: $($_.Exception.Message)"
    exit 1
}
