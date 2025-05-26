#!/bin/bash

# Script to install and link the OCI Voice native module for Android

echo "Installing OCI Voice native module for Android..."

# Navigate to the project root
cd "$(dirname "$0")"

# Install the module
npm install ./custom-modules/react-native-oci-voice --save

# Ensure the Android directory exists
if [ ! -d "./android" ]; then
  echo "Error: Android directory not found. Run 'expo prebuild --platform android' first."
  exit 1
fi

# Check if settings.gradle already includes our module
if ! grep -q "react-native-oci-voice" "./android/settings.gradle"; then
  echo "Updating settings.gradle..."
  echo "
// Add custom modules
include ':react-native-oci-voice'
project(':react-native-oci-voice').projectDir = new File(rootProject.projectDir, '../custom-modules/react-native-oci-voice/android')" >> ./android/settings.gradle
fi

echo "OCI Voice native module installed successfully."
echo "Next steps:"
echo "1. Run 'expo prebuild --platform android --clean' to apply changes"
echo "2. Run 'expo run:android' to build and run the app"
