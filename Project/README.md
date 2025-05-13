# PerplexitySceneCapture

A responsive React Native app that records using the device's camera and automatically captures the center square portion of the video feed every 5 seconds. The captured images are displayed as overlapping cards in the bottom left of the screen.

## Features

- Camera access with permission handling
- Automatic square image capture every 5 seconds during recording
- Voice-activated capture with custom prompts
- Speech recognition for hands-free operation
- Responsive design that adapts to device orientation changes
- Visual indicator of the capture area in the center of the screen
- Card-style display of captured images in the bottom left corner
- Recording state indicator
- Simple record/stop button interface

## How to Use

1. Start the app
2. Grant camera, microphone and media permissions when prompted
3. Press the "Record" button to begin recording, or use voice commands

## Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Run on Web
npm run web
```

## Production Builds

To create production builds with all debug code and console logs removed:

```bash
# For Android
npm run prod:android

# For iOS
npm run prod:ios

# For Web
npm run build:web
```

The production builds use Babel's transform-remove-console plugin to automatically strip all console.log statements from the code while preserving critical error messages.

## Configuration

The app uses various configuration files:

- `app.json` - Expo configuration
- `babel.config.js` - Babel configuration, including console log removal for production
- `eas.json` - EAS Build configuration
4. The app will automatically capture images every 5 seconds
5. Captured images appear as cards in the bottom left
6. Press "Stop" to end recording and capture process

## Android Microphone Permissions

For Android users experiencing microphone issues:

1. Make sure you've granted microphone permissions to the app
2. Long-press the microphone button (🎙️) to run a microphone test that will diagnose common issues
3. If the test fails, follow the specific troubleshooting guidance provided

### Common Android Microphone Issues

- **Permission Denied**: Go to Settings > Apps > PerplexitySceneCapture > Permissions and enable Microphone
- **Microphone Muted**: Check if your device's microphone is muted in the system settings
- **No Audio Detected**: Ensure your microphone is not physically blocked or covered
- **Other Apps Using Microphone**: Close other apps that might be using the microphone
- **Restart Required**: Some devices require a restart after granting microphone permissions

**Additional Troubleshooting for Android Devices:**

- **Missing Native Audio Modules**: If you see "audio manager module not available" in logs, restart your device and try again
- **Audio API Compatibility**: Some newer Android devices may require specific compatibility settings
  1. Go to Settings > Apps > PerplexitySceneCapture > Advanced > API compatibility
  2. Try switching between different API levels if available
- **Background Processes**: Kill background processes that might be interfering with audio
  1. Go to Settings > Apps > Running
  2. Force stop any audio-related apps or services

For Xiaomi, Redmi, POCO and similar devices:
1. Go to Settings > Privacy > Permissions
2. Find "Microphone" and ensure it's enabled for this app
3. Check for any system-level microphone protection that might be blocking the app
4. Disable "MIUI Optimization" in Developer Options temporarily

If issues persist, try these steps:
1. Clear the app's cache: Settings > Apps > PerplexitySceneCapture > Storage > Clear Cache
2. Reinstall the app with microphone permissions granted on first prompt
3. Make sure "Allow background activity" is enabled for more reliable audio processing

If you're using Android 11+ (API level 30 or higher), temporary permissions might expire after a few days. You may need to re-grant them regularly.

If issues persist, try restarting the app and your device.

## Technical Implementation

- Uses Expo Camera for video recording
- Azure Speech Services for voice recognition
- Responsive layout adapts to orientation changes
- Capture area is determined by the smaller dimension of the screen
- Images are stored in an array with a limit of 10 for performance
- Overlapping card effect created with negative margins and z-index

## Development

### Prerequisites

- Node.js
- Expo CLI
- React Native development environment

### Installation

```bash
npm install
```

### Running the App

```bash
npx expo start
```

Scan the QR code with the Expo Go app on your mobile device or use an emulator.

## Dependencies

- expo
- expo-camera
- expo-media-library
- expo-screen-orientation
- expo-status-bar
- react-native-gesture-handler
- react-native-reanimated
- react-native-safe-area-context
- microsoft-cognitiveservices-speech-sdk
- text-encoding (for TextEncoder/TextDecoder polyfill)