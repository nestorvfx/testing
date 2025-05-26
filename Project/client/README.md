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

## Voice Recognition

This application uses Oracle Cloud Infrastructure (OCI) Speech service for voice recognition:

- **Web Platform**: Uses WebSockets directly from JavaScript to connect to OCI Speech service
- **Android Platform**: Uses a custom native module for optimal performance and reliability
- **Cross-Platform API**: Same developer API works across all platforms

For more information about the Android implementation, see [ANDROID_SPEECH.md](./ANDROID_SPEECH.md).

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
  - Oracle Cloud Infrastructure Speech Service (primary)
  - Custom recognition module for web and native platforms
- **Cross-platform**: Unified codebase with platform-specific optimizations

## Project Structure

This project is organized into two main components:

- `client/`: The React Native application (Expo-based)
- `server/`: The authentication proxy server for OCI Speech service

## Requirements

- iOS 13+ or Android 7+
- Web: Modern browsers (Chrome, Firefox, Safari, Edge)
- Node.js (v14 or later)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- OCI account with Speech service enabled
- Camera and microphone permissions required
- Internet connection for analysis functions

## Installation

```bash
# Install all dependencies (root, server, and client)
npm run install:all

# OR install each component separately:

# Root project dependencies
npm install

# Server dependencies
cd server && npm install

# Client dependencies
cd client && npm install
```

## Configuration

Ensure your OCI credentials are properly set up in `server/config/config.txt` with the following format:

```
user=ocid1.user.oc1..aaaaaaaa...
fingerprint=xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx
tenancy=ocid1.tenancy.oc1..aaaaaaaa...
region=your-region-1
key_file=your-private-key.pem
compartmentId=ocid1.tenancy.oc1..aaaaaaaa...
```

## Running the Project

### Web Platform

```bash
# Start the authentication server
cd server && npm start

# In another terminal, start the client in web mode
cd client && npm run web
```

### Android Platform

First, set up the Android build with the OCI Voice module:

```bash
# Install the OCI Voice module and prebuild the Android project
cd client && npm run setup:android

# Run the app on an Android device or emulator
npm run android
```

Or you can do it step by step:

```bash
# Install the OCI Voice module
cd client && npm run install:android-module

# Prebuild the Android project
npm run prebuild:android

# Run the app
npm run android
```

### iOS Platform

You can run the project in several ways:

### Option 1: Start both server and client with one command

```bash
npm run start:both
```

### Option 2: Start server and client separately

In one terminal, start the server:
```bash
npm run start:server
```

In another terminal, start the client:
```bash
npm run start:client
```

### Option 3: Run just the client (using simulated speech service)

```bash
cd client
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

### OCI Authentication Errors

If you encounter an error like:

```
Error getting session token: {
  statusCode: 404,
  message: 'NotAuthorizedOrNotFound'
}
```

Check the following:

1. Verify that all credentials in your config file belong to the same tenancy
2. Ensure your OCI user has the proper permissions and policies set up
3. Validate that your private key file is correctly formatted and accessible
4. Confirm the key file path is correctly specified in your config.txt

### Testing Without OCI Authentication

The client application includes a fallback simulation mode that activates when authentication fails. This allows you to test the UI flow without a valid OCI connection.

## Development

This project uses several custom components:
- Custom crypto-polyfill for web platform compatibility
- Android-specific audio fixes for improved voice recognition
- Cross-platform camera handling with platform-specific optimizations
- Custom continuous speech recognition module for Android

## License

MIT License - See LICENSE file for details
