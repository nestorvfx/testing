# PhotoAndAnalyze

AI-powered image analysis app with voice recognition. Take photos and get instant AI analysis using Perplexity AI and Oracle Cloud Speech services.

## 🚀 Quick Setup

### Prerequisites
- Node.js 18+
- Expo CLI: `npm install -g @expo/cli`
- New API keys (see Configuration below)

### Installation
```bash
npm install
cd server && npm install && cd ../client && npm install && cd ..
```

### Configuration

#### 1. Perplexity AI (Client)
Edit `client/.env`:
```bash
EXPO_PUBLIC_PERPLEXITY_API_KEY=your_perplexity_api_key_here
```

#### 2. Oracle Cloud (Server)
Edit `server/.env`:
```bash
OCI_USER_OCID=your_user_ocid_here
OCI_TENANCY_OCID=your_tenancy_ocid_here
OCI_FINGERPRINT=your_fingerprint_here
OCI_PRIVATE_KEY_PATH=./config/your-private-key.pem
OCI_REGION=eu-amsterdam-1
```

Place your OCI private key in `server/config/`

### Running
```bash
# Start server
cd server && npm run dev

# Start client (new terminal)
cd client && npm start
```

## 📱 Features

- **Smart Capture**: Camera with auto-analysis
- **Voice Control**: Voice-activated commands  
- **AI Analysis**: Scene recognition via Perplexity AI
- **Deep Analysis**: Multi-image connections
- **Cross-Platform**: Web, Android, iOS

## 🛠️ Commands

```bash
# Development
npm run start:both          # Start server + client
npm run start:server        # Server only
npm run start:client        # Client only

# Production builds
npm run build:all           # Build both
cd client && npm run prod:android  # Android release

# Android setup
cd client && npm run setup:android  # Install native modules
```

## 🔒 Security

- ✅ Environment variables for all credentials
- ✅ No hardcoded API keys
- ✅ Git history cleaned of secrets
- ✅ Runtime validation and error handling

## 📋 Troubleshooting

**API Key Issues**: Verify keys in `.env` files and restart services
**OCI Errors**: Check all OCI credentials and private key path  
**Camera/Voice**: Grant permissions when prompted
**Build Issues**: Run `expo prebuild --clean` before building

## 📄 License

MIT License