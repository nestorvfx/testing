# This script links the custom Azure Continuous Speech module to the React Native project

# Go to project root
Set-Location -Path $PSScriptRoot

# Clean and prepare the custom module
Set-Location -Path "custom-modules\react-native-azure-continuous-speech"

# Clean any existing build artifacts
if (Test-Path -Path "android\build") {
    Remove-Item -Path "android\build" -Recurse -Force
}

# Return to project root
Set-Location -Path "..\..\"

# Link the custom module using npm link
npm link "./custom-modules/react-native-azure-continuous-speech"

# Rebuild the Android app
Set-Location -Path "android"
./gradlew clean
Set-Location -Path ".."

Write-Host "Azure Continuous Speech module linked successfully."
Write-Host "Please rebuild your app with 'npx expo run:android' to apply changes."
