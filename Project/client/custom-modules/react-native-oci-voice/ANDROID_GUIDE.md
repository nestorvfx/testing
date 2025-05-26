# OCI Voice Recognition for Android

This document provides information on how the OCI Voice Recognition module works on Android.

## Overview

The Android integration for OCI Voice Recognition uses a native module that directly connects to the OCI Speech service over WebSockets. The module:

1. Captures audio from the device microphone
2. Streams the audio data to OCI Speech service in real-time
3. Receives transcription results and emits them as events to the JavaScript layer
4. Handles authentication and reconnection

## Architecture

### Components

1. **OCIVoiceModule (Java)** - Native Android module that implements the React Native interface
2. **OCIVoicePackage (Java)** - Package registration for React Native
3. **OCIVoiceNative (JavaScript)** - JavaScript wrapper for the native module
4. **ociVoiceService.js** - Platform-agnostic service that delegates to the appropriate implementation

### Data Flow

1. The user interacts with the VoiceButton component
2. The component calls methods on ociVoiceService.js
3. The service detects the platform and:
   - On Web: Uses WebSockets directly from JavaScript
   - On Android: Delegates to OCIVoiceNative
4. The OCIVoiceNative module communicates with the Java implementation
5. The Java code handles audio capture and WebSocket communication
6. Transcription results are sent back through events to JavaScript

## Implementation Details

### Audio Capture

The Android implementation uses `AudioRecord` to capture audio from the microphone. It configures:

- **Sample Rate**: 16kHz
- **Channels**: Mono
- **Format**: 16-bit PCM

### WebSocket Communication

The module uses OkHttp3 for WebSocket communication with the OCI Speech service. The connection follows these steps:

1. Connect to the WebSocket endpoint
2. Send authentication message with token and compartment ID
3. Stream audio data as binary messages
4. Receive transcription results as JSON messages

### Event Handling

The module emits these events to JavaScript:

- `onSpeechStart` - When speech recognition starts
- `onSpeechEnd` - When speech recognition ends
- `onSpeechResults` - When final transcription results are received
- `onSpeechPartialResults` - When partial transcription results are received
- `onSpeechError` - When an error occurs
- `onSpeechVolumeChanged` - When the audio volume changes

## Integration Guide

### Prerequisites

- Android SDK 21+
- OCI account with Speech service enabled
- Authentication server for token generation

### Setup

1. Install the custom module:
   ```
   npm install ./custom-modules/react-native-oci-voice --save
   ```

2. Link the module:
   - Update settings.gradle
   - Add the package to MainApplication.java

3. Ensure permissions are properly requested:
   - RECORD_AUDIO
   - INTERNET

### Usage

See the README.md file in the module directory for complete usage examples.

## Troubleshooting

### Common Issues

1. **Microphone Permission Denied**
   - Ensure the app requests RECORD_AUDIO permission
   - Verify the permission is granted in settings

2. **Authentication Failures**
   - Check that the token is valid and not expired
   - Verify the compartment ID is correct

3. **Audio Capture Issues**
   - Ensure no other app is using the microphone
   - Check if the microphone is working properly

4. **WebSocket Connection Issues**
   - Verify network connectivity
   - Check if the OCI Speech service is available in your region

### Debugging

The module includes extensive logging using Android's Log system. Filter logs with the tag `OCIVoiceModule` to see relevant messages.
