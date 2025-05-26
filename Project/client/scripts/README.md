# Scripts for OCI Voice Integration

This directory contains scripts to help set up and configure the OCI Voice integration.

## Android Integration Scripts

### `Install-OciVoiceAndroid.ps1` (Windows)

PowerShell script to install and link the OCI Voice native module for Android.

Usage:
```powershell
.\scripts\Install-OciVoiceAndroid.ps1
```

### `install-oci-voice-android.sh` (macOS/Linux)

Bash script to install and link the OCI Voice native module for Android.

Usage:
```bash
./scripts/install-oci-voice-android.sh
```

## What these scripts do

1. Install the custom OCI Voice native module
2. Update the Android settings.gradle to include the module
3. Provide next steps for building and running the app

## Prerequisites

- You must have run `expo prebuild --platform android` at least once to create the Android project
- You need npm installed and accessible from the command line

## After running the scripts

After running the appropriate script for your platform, you should:

1. Run `expo prebuild --platform android --clean` to apply the changes
2. Run `expo run:android` to build and run the app on an Android device or emulator

## Troubleshooting

If you encounter issues:

1. Make sure you've run `expo prebuild --platform android` first
2. Check that the custom-modules directory exists and contains the react-native-oci-voice module
3. Ensure you have the necessary Android development tools installed
4. Try manually linking the module by following the instructions in the module's README.md
