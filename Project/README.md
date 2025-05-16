# Perplexity Scene Capture

A mobile application that lets you capture images and get AI-powered analysis of their content. This tool helps you identify and learn about objects, scenes, or documents through your camera.

## Features

- **Multi-platform Camera**: Capture photos across iOS, Android, and web platforms
- **Voice-activated Capture**: Speak to automatically capture photos with attached voice context
- **Visual Analysis**: Process images through Perplexity AI to identify content
- **Multi-image Analysis**: Connect information across several related photos
- **Immediate or Batch Processing**: Choose between instant or later analysis
- **Offline Capability**: Take photos without internet and analyze when connected

## How It Works

1. **Capture Photos**: Use the camera button or voice commands to take pictures
2. **Voice Capture**: When voice mode is active, speaking automatically captures an image and attaches your words as context
3. **Process Images**: Send photos for AI analysis individually or in batches
4. **View Results**: Receive detailed information about what's in each photo
5. **Deep Analysis**: Compare multiple images to find connections between them

## Key Controls

- **Voice Button**: Toggle voice capture mode (top right)
- **Immediate Analysis**: Toggle automatic analysis after capture (next to voice button)
- **Capture Button**: Take photos manually (center bottom)
- **Analyze Button**: Process pending images (bottom right)
- **Deep Analysis**: Analyze connections between multiple images (bottom right)
- **Card Stack**: View and expand captured images (bottom left)

## Technical Overview

- **Framework**: React Native with Expo
- **Image Analysis**: Perplexity AI API integration with two models:
  - Standard analysis for individual images
  - Deep research model for multi-image connections
- **Speech Recognition**: Tiered fallback system:
  - Azure Speech Services (primary)
  - Web Speech API (web fallback)
  - Custom continuous recognition module for Android
- **Cross-platform**: Unified codebase with platform-specific optimizations

## Requirements

- iOS 13+ or Android 7+
- Web: Modern browsers (Chrome, Firefox, Safari, Edge)
- Camera and microphone permissions required
- Internet connection for analysis functions

## Installation

```bash
# Clone the repository
git clone https://github.com/your-username/perplexity-scene-capture.git

# Navigate to project directory
cd perplexity-scene-capture

# Install dependencies
npm install

# Start the application
npm start
```

## Data Handling

- Images are processed through secure API connections
- Voice data is processed locally when possible
- Analysis results are stored on your device only
- No permanent cloud storage of user content

## Troubleshooting

- **Camera Issues**: Verify camera permissions in device settings
- **Voice Recognition Problems**: Check microphone permissions and try using the long-press diagnostic on the voice button
- **Analysis Failures**: Confirm internet connectivity
- **Android Voice Issues**: The app includes automatic fixes for common Android microphone problems

## Development

This project uses several custom components:
- Custom crypto-polyfill for web platform compatibility
- Android-specific audio fixes for improved voice recognition
- Cross-platform camera handling with platform-specific optimizations
- Custom continuous speech recognition module for Android

## License

MIT License - See LICENSE file for details
