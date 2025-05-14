# React Native Azure Continuous Speech

A React Native module that integrates Azure Speech SDK with continuous recognition support for Android. This module was specifically created to improve microphone input handling for speech recognition on Android devices.

## Features

- Continuous speech recognition on Android using Azure Speech SDK
- Properly handles microphone input with enhanced stability
- Provides both final and interim recognition results 
- Handles session management and error recovery

## Implementation Details

This module implements the Azure Cognitive Services Speech SDK for Android using the continuous recognition approach from the [Azure Samples continuous-reco](https://github.com/Azure-Samples/cognitive-services-speech-sdk/tree/master/samples/kotlin/android/continuous-reco) project.

Key improvements:
- Properly initialized microphone stream using the recommended approach from Azure Samples
- Continuous recognition with improved event handling
- Better error recovery and resource management

## Installation

```bash
npm install --save ./custom-modules/react-native-azure-continuous-speech
```

## Usage

```javascript
import AzureContinuousSpeech from 'react-native-azure-continuous-speech';

// Check if the module is available
const isAvailable = await AzureContinuousSpeech.isAvailable();

if (isAvailable) {
  // Initialize with Azure subscription key and region
  await AzureContinuousSpeech.initialize(
    'your-subscription-key', 
    'your-region',
    { language: 'en-US' }
  );
  
  // Set up event handlers
  AzureContinuousSpeech.setCallbacks({
    onSpeechStart: (event) => {
      console.log('Speech recognition started');
    },
    onSpeechEnd: (event) => {
      console.log('Speech recognition ended');
    },
    onSpeechResults: (event) => {
      console.log('Final result:', event.value);
    },
    onSpeechPartialResults: (event) => {
      console.log('Interim result:', event.value);
    },
    onSpeechError: (error) => {
      console.error('Recognition error:', error);
    }
  });
  
  // Start recognition
  await AzureContinuousSpeech.start();
  
  // Later, stop recognition
  await AzureContinuousSpeech.stop();
  
  // When done with the recognizer, destroy it to free resources
  await AzureContinuousSpeech.destroy();
}
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
