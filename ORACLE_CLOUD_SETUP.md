# Oracle Cloud Infrastructure (OCI) Setup Guide - Always Free Tier

## Overview
This guide will help you set up a production server on Oracle Cloud Infrastructure using the Always Free tier, which includes:
- 2 AMD Compute VMs (1 OCPU, 1GB RAM each)
- OR 1 Ampere A1 Compute VM (4 OCPUs, 24GB RAM total - can be split)
- 100GB Block Storage
- 20GB Object Storage
- 10GB Archive Storage
- Load Balancer (1 instance)

## Step 1: Create OCI Account

1. Go to https://cloud.oracle.com/
2. Click "Start for free"
3. Fill in your details (requires credit card for verification, but won't be charged)
4. Verify your phone number and email
5. Wait for account activation (can take up to 24 hours)

## Step 2: Create a Compute Instance

### Option A: ARM-based Ampere A1 (Recommended - Better Performance)
1. Navigate to **Compute > Instances**
2. Click **Create Instance**
3. Configure:
   - **Name**: `perplexity-scene-server`
   - **Placement**: Choose any availability domain
   - **Image**: `Ubuntu 22.04 LTS` (or `Oracle Linux 8`)
   - **Shape**: Click "Change Shape"
     - Shape series: `Ampere`
     - Shape: `VM.Standard.A1.Flex`
     - OCPUs: `2` (you can use up to 4 total across all instances)
     - Memory: `12 GB` (you can use up to 24GB total)

### Option B: AMD x86 (Fallback if A1 unavailable)
1. Navigate to **Compute > Instances**
2. Click **Create Instance**
3. Configure:
   - **Name**: `perplexity-scene-server`
   - **Image**: `Ubuntu 22.04 LTS`
   - **Shape**: `VM.Standard.E2.1.Micro` (1 OCPU, 1GB RAM)

### Network Configuration
1. **Virtual Cloud Network**: Create new or use existing
2. **Subnet**: Create in public subnet
3. **Assign public IPv4 address**: ✅ Checked
4. **SSH Keys**: 
   - Generate new key pair OR upload your existing public key
   - **IMPORTANT**: Download and save the private key securely

## Step 3: Configure Security Rules

1. Go to **Networking > Virtual Cloud Networks**
2. Click on your VCN
3. Click **Security Lists** > **Default Security List**
4. Click **Add Ingress Rules**

Add these rules:
```
# SSH
Source: 0.0.0.0/0
IP Protocol: TCP
Destination Port: 22

# HTTP
Source: 0.0.0.0/0
IP Protocol: TCP
Destination Port: 80

# HTTPS
Source: 0.0.0.0/0
IP Protocol: TCP
Destination Port: 443

# Custom App Port (3000)
Source: 0.0.0.0/0
IP Protocol: TCP
Destination Port: 3000
```

## Step 4: Connect to Your Instance

### Using SSH from Windows PowerShell
```powershell
# Replace with your actual private key path and instance IP
ssh -i "path\to\your\private-key.key" ubuntu@YOUR_INSTANCE_PUBLIC_IP
```

### Using PuTTY (Alternative for Windows)
1. Download PuTTY and PuTTYgen
2. Convert your private key to .ppk format using PuTTYgen
3. Connect using PuTTY with the .ppk file

## Step 5: Server Setup

Once connected to your instance, run these commands:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx -y

# Enable and start services
sudo systemctl enable nginx
sudo systemctl start nginx

# Create app directory
sudo mkdir -p /var/www/perplexity-scene-server
sudo chown ubuntu:ubuntu /var/www/perplexity-scene-server
```

## Step 6: Configure Domain (Optional but Recommended)

If you have a domain:
1. Point your domain's A record to your instance's public IP
2. Install Let's Encrypt SSL certificate:

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com
```

## Step 7: Deploy Your Server

```bash
# Navigate to app directory
cd /var/www/perplexity-scene-server

# Clone your repository (replace with your actual repo)
git clone https://github.com/yourusername/PerplexitySceneCapture.git .

# Install dependencies
cd server
npm install

# Build the application
npm run build

# Set up environment variables
cp .env.example .env
nano .env  # Edit with your actual values
```

## Step 8: Configure PM2

```bash
# Create PM2 ecosystem file
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
    time: true
  }]
};
EOF

# Create logs directory
mkdir -p logs

# Start application with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Run the command that PM2 outputs (it will be sudo systemctl enable pm2-ubuntu)
```

## Step 9: Configure Nginx as Reverse Proxy

```bash
sudo nano /etc/nginx/sites-available/perplexity-scene-server
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/perplexity-scene-server /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Step 10: Set Up OCI Object Storage (Optional)

For file storage and CDN:

1. Go to **Storage > Buckets**
2. Create a new bucket
3. Set visibility to "Public" if needed
4. Use OCI SDK in your application to upload files

## Step 11: Monitoring and Maintenance

```bash
# View PM2 status
pm2 status

# View logs
pm2 logs

# Restart application
pm2 restart perplexity-scene-server

# Monitor system resources
htop

# Check disk usage
df -h
```

## Cost Optimization Tips

1. **Always Free Tier Limits**: Monitor your usage in the OCI console
2. **Ampere A1**: More cost-effective and powerful than x86 micro instances
3. **Auto-scaling**: Not available in free tier, but you can manually scale
4. **Backup**: Use the free 100GB block storage for backups

## Security Best Practices

1. **Regular Updates**: Keep your system updated
2. **Firewall**: Configure iptables or ufw
3. **SSH Security**: Disable password authentication, use keys only
4. **Regular Backups**: Create instance backups regularly
5. **Monitor Logs**: Set up log monitoring and alerts

## Troubleshooting

### Common Issues:
1. **Can't create A1 instance**: Try different availability domains or regions
2. **SSH connection refused**: Check security list rules
3. **PM2 not starting on boot**: Verify startup script installation
4. **High memory usage**: Monitor with `htop` and optimize your application

### Useful Commands:
```bash
# Check system resources
free -h
df -h
top

# Check nginx status
sudo systemctl status nginx

# Check PM2 status
pm2 status
pm2 logs

# Restart services
sudo systemctl restart nginx
pm2 restart all
```

This setup provides a robust, production-ready environment for your Perplexity Scene Capture server using Oracle Cloud's Always Free tier.
