# PhotoAndAnalyze

## How to Use

### Android App
1. Download: [Photo And Analyze.apk](releases/Photo%20And%20Analyze.apk)
2. On your Android device, enable "Install from Unknown Sources" in Settings → Security
3. Install the APK and grant camera, microphone, and storage permissions

### Web App
- Visit: https://nestorvfx.github.io/PhotoAndAnalyze/

---

A React Native app that combines camera functionality with AI-powered image analysis and voice recognition. Take photos and receive instant analysis using Perplexity AI with optional voice commands powered by Oracle Cloud Speech services.

## Features

### **Camera & Photography**
- Camera with real-time capture
- Automatic AI analysis of captured photos
- Voice-activated photo capture
- Custom analysis prompts

### **Voice Recognition**
- Speech-to-text powered by Oracle Cloud Speech
- Voice commands for hands-free operation
- Real-time speech feedback
- Cross-platform support (web, Android)

### **AI Analysis**
- Automatic scene and object identification
- Multi-photo analysis for pattern recognition
- Custom questions about photos
- Detailed descriptions and contextual information

### **Organization**
- Photo timeline with attached analysis
- Expandable photo cards with detailed insights
- Batch analysis capabilities
- Export photos with analysis data

## 🎯 Use Cases

- **Travelers** exploring new places and wanting to learn about landmarks, architecture, or local culture
- **Students** who need quick research and identification of plants, animals, objects, or historical sites
- **Professionals** documenting work environments, equipment, or processes with instant context
- **Curious individuals** who want to understand more about the world around them

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Expo CLI: `npm install -g @expo/cli`
- API Keys: [Perplexity AI](https://perplexity.ai) + [Oracle Cloud Infrastructure](https://cloud.oracle.com) (Speech service)

### Setup
```bash
git clone https://github.com/nestorvfx/PhotoAndAnalyze.git
cd PhotoAndAnalyze

# Install everything
npm run install:all

# Start the app
npm run start:both
```

## 💡 How It Works

1. **Point & Capture**: Use the camera to take photos of anything interesting
2. **Speak Your Intent**: Optionally use voice commands to specify what you want to know
3. **Instant Analysis**: AI immediately analyzes your photo and provides rich context
4. **Explore Results**: Read detailed descriptions, key facts, and insights
5. **Deep Dive**: Select multiple photos for pattern analysis and connections

## 🔧 Available Commands

```bash
# Development
npm run start:both          # Start server + client together
npm run start:server        # Authentication server only  
npm run start:client        # Mobile app only

# Production
npm run build:all           # Build both components
cd client && npm run prod:android  # Android release build

# Android Native Modules
cd client && npm run setup:android  # Configure native dependencies
```

## 🔒 Security & Privacy

- **Secure Configuration**: All API keys stored in environment variables
- **Runtime Protection**: Input validation and error handling throughout
- **Local Processing**: Photos processed securely through encrypted connections

## 🌐 Cross-Platform Support

- **Web**: Full functionality with WebRTC voice recognition
- **Android**: Native speech recognition with optimized camera

## 📄 License

MIT License - Feel free to use, modify, and distribute

