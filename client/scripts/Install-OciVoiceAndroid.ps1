# PowerShell script to install and link the OCI Voice native module for Android

Write-Host "Installing OCI Voice native module for Android..." -ForegroundColor Green

# Navigate to the project root
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -Path (Join-Path $scriptPath "..")

# Install the module
npm install ./custom-modules/react-native-oci-voice --save

# Ensure the Android directory exists
if (-not (Test-Path -Path "./android")) {
    Write-Host "Error: Android directory not found. Run 'expo prebuild --platform android' first." -ForegroundColor Red
    exit 1
}

# Check if settings.gradle already includes our module
$settingsGradlePath = "./android/settings.gradle"
$settingsContent = Get-Content -Path $settingsGradlePath -Raw

if (-not ($settingsContent -match "react-native-oci-voice")) {
    Write-Host "Updating settings.gradle..." -ForegroundColor Yellow
    $moduleSettings = @"

// Add custom modules
include ':react-native-oci-voice'
project(':react-native-oci-voice').projectDir = new File(rootProject.projectDir, '../custom-modules/react-native-oci-voice/android')
"@
    Add-Content -Path $settingsGradlePath -Value $moduleSettings
}

Write-Host "OCI Voice native module installed successfully." -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Run 'expo prebuild --platform android --clean' to apply changes" -ForegroundColor Cyan
Write-Host "2. Run 'expo run:android' to build and run the app" -ForegroundColor Cyan
