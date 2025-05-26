# OCI Speech Integration on Android

This document describes how to set up and use the OCI Speech integration on Android devices.

## Overview

The OCI Speech integration for Android uses a custom native module to connect directly to the OCI Speech service. This provides the same functionality as the web implementation but with native performance and reliability on Android devices.

## Features

- Real-time speech recognition using OCI Speech service
- Native audio capture for optimal performance
- Same API as the web implementation
- Supports both final and partial transcription results
- Volume level feedback for UI visualization

## Setup

### Prerequisites

- Android development environment set up
- React Native CLI or Expo development build
- OCI account with Speech service enabled
- Authentication server running

### Installation

The Android module is included in the project and will be automatically linked when building for Android. No additional setup is required beyond the normal Android app build process.

## Usage

The Android implementation is used automatically when running on Android devices. The application code doesn't need to change - the `ociVoiceService.js` detects the platform and uses the appropriate implementation.

## Technical Details

The Android implementation:

1. Uses a native module for audio capture and WebSocket communication
2. Captures audio at 16kHz mono 16-bit PCM
3. Streams audio data directly to OCI Speech WebSocket
4. Emits events for speech recognition results back to JavaScript

## Troubleshooting

### Common Issues

1. **Microphone Permission**
   - Make sure to accept the microphone permission prompt
   - If denied, go to Settings > Apps > [Your App] > Permissions to enable it

2. **Connection Issues**
   - Ensure you have a stable internet connection
   - Check that the authentication server is running

3. **Audio Issues**
   - Check that no other app is using the microphone
   - Restart the app if the microphone doesn't seem to be working

### Logs

To see detailed logs, filter logcat output with:

```
adb logcat -s OCIVoiceModule
```

## Testing

To test the Android implementation:

1. Build and run the app on an Android device or emulator
2. Open the app and press the microphone button
3. Speak into the microphone
4. Verify that the text appears as you speak

## Additional Resources

- See `client/custom-modules/react-native-oci-voice/ANDROID_GUIDE.md` for more details
- See `client/custom-modules/react-native-oci-voice/README.md` for API documentation
