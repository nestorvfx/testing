#!/bin/bash

# This script links the custom Azure Continuous Speech module to the React Native project

# Go to project root
cd "$(dirname "$0")"

# Clean and prepare the custom module
cd custom-modules/react-native-azure-continuous-speech

# Clean any existing build artifacts
rm -rf android/build

# Return to project root
cd ../..

# Clean and reinstall node modules if needed
# npm ci

# Link the custom module using npm link
npm link ./custom-modules/react-native-azure-continuous-speech

# Rebuild the Android app
cd android
./gradlew clean
cd ..

echo "Azure Continuous Speech module linked successfully."
echo "Please rebuild your app with 'npx expo run:android' to apply changes."
