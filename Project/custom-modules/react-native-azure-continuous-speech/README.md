# React Native Azure Continuous Speech

A React Native module that integrates Azure Speech SDK with continuous recognition support for Android. This module was specifically created to improve microphone input handling for speech recognition on Android devices.

## Features

- Continuous speech recognition on Android using Azure Speech SDK
- Properly handles microphone input with enhanced stability
- Provides both final and interim recognition results 
- Handles session management and error recovery

## Installation

```bash
npm install --save ./custom-modules/react-native-azure-continuous-speech
```

## Usage

```javascript
import AzureContinuousSpeech, { configureSpeechRecognition } from 'react-native-azure-continuous-speech';

// Check if the module is available
const isAvailable = await AzureContinuousSpeech.isAvailable();

if (isAvailable) {
  // Set up event handlers
  configureSpeechRecognition({
    onSpeechStart: (event) => {
      console.log('Speech recognition started');
    },
    onSpeechEnd: (event) => {
      console.log('Speech recognition ended');
    },
    onSpeechResults: (results) => {
      console.log('Final results:', results.value);
    },
    onSpeechPartialResults: (results) => {
      console.log('Interim results:', results.value);
    },
    onSpeechError: (error) => {
      console.error('Speech recognition error:', error);
    }
  });
  
  // Initialize with Azure subscription key and region
  await AzureContinuousSpeech.initialize(
    'your-subscription-key',
    'your-region',
    { language: 'en-US' }
  );
  
  // Start recognition
  await AzureContinuousSpeech.start();
  
  // Later, stop recognition
  await AzureContinuousSpeech.stop();
  
  // When done, clean up resources
  await AzureContinuousSpeech.destroy();
}
```
```

## API Reference

### Methods

- `isAvailable()`: Checks if the module is available on the current platform
- `initialize(subscriptionKey, region, options)`: Initializes the speech recognizer
- `start()`: Starts continuous speech recognition
- `stop()`: Stops continuous speech recognition
- `destroy()`: Cleans up resources

### Event Callbacks (via configureSpeechRecognition)

- `onSpeechStart`: Called when speech recognition starts
- `onSpeechEnd`: Called when speech recognition ends
- `onSpeechResults`: Called with final recognition results
- `onSpeechPartialResults`: Called with interim recognition results
- `onSpeechError`: Called when an error occurs

## Requirements

- React Native >= 0.60.0
- Android SDK >= 21
- Azure Speech Services subscription

## License

MIT
