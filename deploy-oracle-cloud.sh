#!/bin/bash

# Oracle Cloud Server Deployment Script
# Run this script on your Oracle Cloud instance

set -e

echo "🚀 Starting Oracle Cloud Server Deployment..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS
echo "📦 Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2, Nginx, and other essentials
echo "📦 Installing essential packages..."
sudo npm install -g pm2
sudo apt install nginx git htop ufw -y

# Create application directory
echo "📁 Setting up application directory..."
sudo mkdir -p /var/www/perplexity-scene-server
sudo chown $USER:$USER /var/www/perplexity-scene-server

# Configure firewall
echo "🔐 Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw allow 3000
sudo ufw --force enable

# Clone and setup application
echo "📥 Setting up application..."
cd /var/www/perplexity-scene-server

# If you're running this manually, replace with your actual repository
# git clone https://github.com/yourusername/PerplexitySceneCapture.git .

# For now, we'll create the server structure
mkdir -p server
cd server

echo "📦 Installing server dependencies..."
# Copy your package.json and install dependencies
npm install

echo "🔧 Building application..."
npm run build

# Create PM2 ecosystem configuration
echo "⚙️ Creating PM2 configuration..."
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'perplexity-scene-server',
    script: './dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF

# Create logs directory
mkdir -p logs

# Configure Nginx
echo "🌐 Configuring Nginx..."
sudo tee /etc/nginx/sites-available/perplexity-scene-server > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    location / {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://localhost:3000/health;
    }
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/perplexity-scene-server /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t

# Start and enable services
echo "🚀 Starting services..."
sudo systemctl enable nginx
sudo systemctl start nginx
sudo systemctl reload nginx

# Setup PM2 startup
pm2 startup | tail -1 | sudo bash

echo "✅ Deployment completed!"
echo ""
echo "📋 Next steps:"
echo "1. Copy your server files to /var/www/perplexity-scene-server/server/"
echo "2. Create and configure your .env file with OCI credentials"
echo "3. Start your application with: pm2 start ecosystem.config.js"
echo "4. Save PM2 configuration: pm2 save"
echo ""
echo "🌐 Your server will be available at: http://$(curl -s ifconfig.me)"
