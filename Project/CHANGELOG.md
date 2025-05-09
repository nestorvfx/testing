# Changelog

## [1.0.0] - 2025-05-09

### Production Release
- Removed all debug features and debugging code
- Added Babel plugin to strip console.log statements in production
- Created production build scripts

### Cleanup
- Removed unnecessary debug/test files:
  - `MicrophoneTest.js`
  - `MicrophoneTestButton.js`
  - `MicrophoneTestModal.js`
  - `VoiceDebugOverlay.js`
  - `speechLogger.js`
  - `Azure Speech Recognition SAMPLE.js`

- Removed console logs from:
  - `crypto-polyfill.js`
  - `webSpeechFallback.js`
  - `androidAudioFix.js`
  - `polyfills.js`
  - `useCamera.js`

- Simplified logging in service files to only log critical errors
- Removed debug UI components from App.js
- Removed debug state variables and props
- Removed web debug button
- Streamlined code for production use
