# React Native Android Speech Recognition

A React Native library that provides a simple interface to the native Android SpeechRecognizer API.

## Installation

```bash
npm install react-native-android-speech --save
```

### Automatic Linking (React Native >= 0.60)

The package will be linked automatically. Just rebuild your app:

```bash
npx react-native run-android
```

### Manual Linking (React Native < 0.60)

```bash
react-native link react-native-android-speech
```

### Add Permissions

Add the following to your `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

## Usage

```javascript
import AndroidSpeech from 'react-native-android-speech';
import { PermissionsAndroid } from 'react-native';

// Check for permissions first
const requestMicrophonePermission = async () => {
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: "Microphone Permission",
        message: "This app needs access to your microphone for speech recognition",
        buttonNeutral: "Ask Me Later",
        buttonNegative: "Cancel",
        buttonPositive: "OK"
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn(err);
    return false;
  }
};

// Start speech recognition
const startSpeechRecognition = async () => {
  // Check if speech recognition is available
  const available = await AndroidSpeech.checkAvailability();
  if (!available) {
    alert('Speech recognition is not available on this device');
    return;
  }
  
  // Request permission
  const hasPermission = await requestMicrophonePermission();
  if (!hasPermission) {
    alert('Permission denied');
    return;
  }
  
  // Start listening
  try {
    await AndroidSpeech.start({
      language: 'en-US' // optional, defaults to device locale
    });
  } catch (error) {
    console.error('Error starting speech recognition:', error);
  }
};

// Stop speech recognition
const stopSpeechRecognition = async () => {
  try {
    await AndroidSpeech.stop();
  } catch (error) {
    console.error('Error stopping speech recognition:', error);
  }
};

// Set up event listeners
useEffect(() => {
  // Speech started
  const speechStartListener = AndroidSpeech.addListener(
    AndroidSpeech.events.START,
    () => {
      console.log('Speech recognition started');
    }
  );
  
  // Speech ended
  const speechEndListener = AndroidSpeech.addListener(
    AndroidSpeech.events.END,
    () => {
      console.log('Speech recognition ended');
    }
  );
  
  // Speech results
  const speechResultsListener = AndroidSpeech.addListener(
    AndroidSpeech.events.RESULTS,
    (event) => {
      console.log('Speech results:', event.value);
    }
  );
  
  // Speech error
  const speechErrorListener = AndroidSpeech.addListener(
    AndroidSpeech.events.ERROR,
    (event) => {
      console.error('Speech recognition error:', event.error);
    }
  );
  
  // Clean up listeners
  return () => {
    speechStartListener.remove();
    speechEndListener.remove();
    speechResultsListener.remove();
    speechErrorListener.remove();
  };
}, []);
```

## API

### Methods

- `checkAvailability()` - Check if speech recognition is available on the device
- `start(options)` - Start speech recognition (options: { language })
- `stop()` - Stop speech recognition
- `isRecognizing()` - Check if speech recognition is currently active
- `addListener(eventName, callback)` - Add an event listener
- `removeAllListeners(eventName)` - Remove all listeners for an event

### Events

- `AndroidSpeech.events.START` - Speech recognition has started
- `AndroidSpeech.events.END` - Speech recognition has ended
- `AndroidSpeech.events.RESULTS` - Final speech recognition results
- `AndroidSpeech.events.ERROR` - Speech recognition error
- `AndroidSpeech.events.PARTIAL_RESULTS` - Partial speech recognition results

## License

MIT
