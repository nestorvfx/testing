# PerplexitySceneCapture

A responsive React Native app that records using the device's camera and automatically captures the center square portion of the video feed every 5 seconds. The captured images are displayed as overlapping cards in the bottom left of the screen.

## Features

- Camera access with permission handling
- Automatic square image capture every 5 seconds during recording
- Responsive design that adapts to device orientation changes
- Visual indicator of the capture area in the center of the screen
- Card-style display of captured images in the bottom left corner
- Recording state indicator
- Simple record/stop button interface

## How to Use

1. Start the app
2. Grant camera and media permissions when prompted
3. Press the "Record" button to begin recording
4. The app will automatically capture images every 5 seconds
5. Captured images appear as cards in the bottom left
6. Press "Stop" to end recording and capture process

## Technical Implementation

- Uses Expo Camera for video recording
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