# Production Deployment Checklist

## Pre-Deployment Requirements

### ✅ Oracle Cloud Infrastructure Setup
- [ ] Create OCI account with Always Free tier
- [ ] Create compute instance (Ampere A1 recommended: 2 OCPU, 12GB RAM)
- [ ] Configure security rules (ports 22, 80, 443, 3000)
- [ ] Generate SSH key pair and download private key
- [ ] Note down instance public IP address

### ✅ Domain and SSL (Optional but Recommended)
- [ ] Point domain A record to instance IP
- [ ] Install Let's Encrypt SSL certificate
- [ ] Update CORS origins in server configuration

### ✅ OCI API Keys and Configuration
- [ ] Generate OCI API key pair in OCI Console
- [ ] Note down:
  - Tenancy OCID
  - User OCID
  - API Key Fingerprint
  - Region identifier
- [ ] Upload private key to server
- [ ] Configure .env file with actual values

## Android App Deployment

### ✅ Production Build
- [ ] **App Bundle (AAB)** - For Google Play Store:
  ```powershell
  cd c:\PerplexitySceneCapture\client
  eas build --platform android --profile production
  ```

- [ ] **APK** - For direct distribution:
  ```powershell
  cd c:\PerplexitySceneCapture\client
  eas build --platform android --profile production-apk
  ```

### ✅ Google Play Store Deployment (AAB)
- [ ] Create Google Play Console account
- [ ] Create new app listing
- [ ] Upload AAB file
- [ ] Fill in app details, screenshots, descriptions
- [ ] Set up store listing and pricing
- [ ] Submit for review

### ✅ Direct Distribution (APK)
- [ ] Download APK from EAS Build dashboard
- [ ] Test installation on multiple devices
- [ ] Set up distribution method (website, email, etc.)
- [ ] Consider signing with your own keystore for updates

## Server Deployment

### ✅ Quick Deployment (Automated)
```powershell
# Using PowerShell script
.\Deploy-ToOracle.ps1 -ServerHost "YOUR_INSTANCE_IP" -PrivateKeyPath "path\to\your\private-key.key"
```

### ✅ Manual Deployment Steps

#### 1. Connect to your Oracle Cloud instance:
```powershell
ssh -i "path\to\your\private-key.key" ubuntu@YOUR_INSTANCE_IP
```

#### 2. Run initial setup:
```bash
# Download and run setup script
curl -o deploy-oracle-cloud.sh https://raw.githubusercontent.com/yourusername/PerplexitySceneCapture/main/deploy-oracle-cloud.sh
chmod +x deploy-oracle-cloud.sh
./deploy-oracle-cloud.sh
```

#### 3. Upload your server files:
```powershell
# From your local machine
scp -i "path\to\your\private-key.key" -r .\server\ ubuntu@YOUR_INSTANCE_IP:/var/www/perplexity-scene-server/
```

#### 4. Configure environment variables:
```bash
# On the server
cd /var/www/perplexity-scene-server/server
cp .env.production .env
nano .env  # Edit with your actual OCI credentials
```

#### 5. Build and start application:
```bash
npm install
npm run build
pm2 start ecosystem.config.js
pm2 save
```

### ✅ Environment Configuration
Create `/var/www/perplexity-scene-server/server/.env` with:

```env
NODE_ENV=production
PORT=3000

# OCI Configuration
OCI_TENANCY_ID=ocid1.tenancy.oc1..your_tenancy_id
OCI_USER_ID=ocid1.user.oc1..your_user_id
OCI_FINGERPRINT=your_fingerprint
OCI_PRIVATE_KEY_PATH=/var/www/perplexity-scene-server/server/config/oci-private-key.pem
OCI_REGION=us-ashburn-1

# Frontend URLs
FRONTEND_URL=https://your-domain.com
PRODUCTION_DOMAIN=https://your-domain.com
ALLOWED_ORIGINS=https://your-domain.com,https://app.your-domain.com
```

## Post-Deployment Verification

### ✅ Server Health Checks
- [ ] Server responds at `http://YOUR_IP:3000/health`
- [ ] API endpoints work correctly
- [ ] SSL certificate is valid (if using HTTPS)
- [ ] PM2 process is running: `pm2 status`
- [ ] Nginx is proxying correctly
- [ ] Logs are being written: `pm2 logs`

### ✅ Mobile App Testing
- [ ] App connects to production server
- [ ] Camera functionality works
- [ ] Voice recognition works
- [ ] Image analysis works
- [ ] OCI Speech API integration works
- [ ] Error handling works properly

### ✅ Performance and Security
- [ ] Server handles expected load
- [ ] Memory usage is reasonable
- [ ] SSL/TLS configuration is secure
- [ ] Firewall rules are properly configured
- [ ] Regular backups are scheduled
- [ ] Monitoring is set up

## Maintenance and Updates

### ✅ Regular Tasks
- [ ] Monitor server resources
- [ ] Check application logs
- [ ] Update dependencies regularly
- [ ] Backup server configuration
- [ ] Monitor OCI usage (stay within free tier)

### ✅ Update Deployment
```bash
# To update the server code
git pull origin main
npm install
npm run build
pm2 restart perplexity-scene-server
```

### ✅ Monitoring Commands
```bash
# Check system resources
htop
free -h
df -h

# Check application status
pm2 status
pm2 logs perplexity-scene-server

# Check nginx
sudo systemctl status nginx
sudo nginx -t

# Check firewall
sudo ufw status
```

## Troubleshooting

### ✅ Common Issues
- **Can't create A1 instance**: Try different availability domains
- **SSH connection refused**: Check security list rules
- **PM2 app crashed**: Check logs with `pm2 logs`
- **Nginx 502 error**: Check if app is running on correct port
- **High memory usage**: Monitor with `htop`, restart if needed

### ✅ Useful Commands
```bash
# Restart all services
sudo systemctl restart nginx
pm2 restart all

# Check service status
sudo systemctl status nginx
pm2 status

# View logs
pm2 logs
sudo tail -f /var/log/nginx/error.log

# Check network connectivity
curl -I http://localhost:3000/health
netstat -tlnp | grep 3000
```

## Cost Optimization

### ✅ Oracle Cloud Always Free Limits
- **Compute**: 2 AMD VMs (1 OCPU, 1GB RAM each) OR 1 Ampere A1 (4 OCPUs, 24GB RAM total)
- **Storage**: 100GB block storage, 20GB object storage
- **Network**: 10TB outbound data transfer per month
- **Load Balancer**: 1 instance, 10 Mbps bandwidth

### ✅ Tips to Stay Within Limits
- Use Ampere A1 for better performance per resource
- Monitor usage in OCI console
- Set up billing alerts
- Use object storage for file uploads
- Optimize application for low memory usage

## Security Best Practices

### ✅ Server Security
- [ ] Regular security updates
- [ ] SSH key-only authentication
- [ ] Firewall properly configured
- [ ] Non-root user for applications
- [ ] Regular backups
- [ ] Log monitoring

### ✅ Application Security
- [ ] Environment variables for secrets
- [ ] Input validation and sanitization
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] HTTPS in production
- [ ] Regular dependency updates

---

## Quick Reference

### Server Information
- **Server URL**: `http://YOUR_INSTANCE_IP`
- **Health Check**: `http://YOUR_INSTANCE_IP/health`
- **SSH Access**: `ssh -i "private-key.key" ubuntu@YOUR_INSTANCE_IP`

### Build Commands
```powershell
# Android AAB (Play Store)
eas build --platform android --profile production

# Android APK (Direct)
eas build --platform android --profile production-apk

# Server Build
npm run build
```

### Deployment Commands
```powershell
# Automated deployment
.\Deploy-ToOracle.ps1 -ServerHost "IP" -PrivateKeyPath "key.pem"

# Manual file upload
scp -i "key.pem" -r .\server\ ubuntu@IP:/var/www/perplexity-scene-server/
```
