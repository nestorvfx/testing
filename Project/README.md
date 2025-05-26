# Perplexity Scene Capture

A React Native application with image capture and AI-powered scene analysis using Perplexity AI and Oracle Cloud Infrastructure (OCI) Speech services.

## 🚀 Quick Setup

### 1. Prerequisites
- Node.js 18+ 
- React Native development environment
- Expo CLI
- New Perplexity AI API key
- New Oracle Cloud Infrastructure credentials

### 2. API Key Configuration

#### **Client Setup (Perplexity AI)**
1. Get your new Perplexity API key from [Perplexity Console](https://docs.perplexity.ai/home)
2. Edit `client/.env` and replace:
```bash
EXPO_PUBLIC_PERPLEXITY_API_KEY=your_actual_perplexity_api_key_here
```

#### **Server Setup (OCI Speech)**
1. Get new OCI credentials from Oracle Cloud Console
2. Download your new private key file to `server/config/`
3. Edit `server/.env` and replace:
```bash
OCI_USER_OCID=your_actual_user_ocid_here
OCI_TENANCY_OCID=your_actual_tenancy_ocid_here
OCI_FINGERPRINT=your_actual_fingerprint_here
OCI_PRIVATE_KEY_PATH=./config/your-private-key.pem
```

### 3. Installation & Running

```bash
# Install all dependencies
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

# Start the server (Terminal 1)
cd server
npm run dev

# Start the client (Terminal 2)  
cd client
npm start
```

## 📱 Features

- **Image Capture**: Take photos with camera or upload from gallery
- **AI Scene Analysis**: Analyze images using Perplexity AI
- **Voice Recognition**: Voice-activated capture and commands
- **Real-time Processing**: Live analysis with progress indicators
- **Secure Configuration**: Environment-based API key management

## 🔒 Security

This application uses secure environment variable configuration:
- API keys are never hardcoded
- Credentials are loaded from `.env` files
- Git history has been cleaned of any exposed secrets

## 🛠️ Development

### Project Structure
- `client/`: React Native Expo application
- `server/`: Node.js/Express authentication server for OCI
- `client/.env`: Client environment variables (Perplexity API)
- `server/.env`: Server environment variables (OCI credentials)

### Commands
```bash
# Development mode
npm run dev           # Start server in dev mode
npm start            # Start client

# Production build
npm run build        # Build server
npm run prod:android # Build client for Android
```

## 📋 Troubleshooting

### Common Issues

**"API key not configured"**
- Check that `EXPO_PUBLIC_PERPLEXITY_API_KEY` is set in `client/.env`
- Ensure the API key starts with `pplx-`

**"Authentication failed"**  
- Verify your Perplexity API key is valid and not revoked
- Check for typos in the `.env` file

**OCI Speech errors**
- Ensure all OCI environment variables are set in `server/.env`
- Verify the private key file path is correct
- Check OCID formats are valid

## 📄 License

MIT License - See LICENSE file for details

---

## 🔑 Summary: Where to Put Your API Keys

### **Client Keys** (Perplexity AI)
**File**: `client/.env`
```bash
EXPO_PUBLIC_PERPLEXITY_API_KEY=your_new_perplexity_key_here
```

### **Server Keys** (Oracle Cloud)
**File**: `server/.env`  
```bash
OCI_USER_OCID=your_new_user_ocid_here
OCI_TENANCY_OCID=your_new_tenancy_ocid_here
OCI_FINGERPRINT=your_new_fingerprint_here
OCI_PRIVATE_KEY_PATH=./config/your-private-key.pem
```

**Private Key File**: `server/config/your-private-key.pem`

After setting up your keys, run:
```bash
cd server && npm run dev
# In new terminal:
cd client && npm start
```