# React Native OCI Voice

A React Native module for Oracle Cloud Infrastructure (OCI) Speech Service.

## Installation

```sh
# Using npm
npm install ./custom-modules/react-native-oci-voice --save

# Using yarn
yarn add ./custom-modules/react-native-oci-voice
```

### Android Setup

1. Add the module to your `settings.gradle`:

```gradle
include ':react-native-oci-voice'
project(':react-native-oci-voice').projectDir = new File(rootProject.projectDir, '../custom-modules/react-native-oci-voice/android')
```

2. Add the module to your `app/build.gradle` dependencies:

```gradle
dependencies {
    // ... other dependencies
    implementation project(':react-native-oci-voice')
}
```

3. Add the package to your `MainApplication.java`:

```java
import com.ocivoice.OCIVoicePackage; // Import the package

// Add the package in the getPackages() method
@Override
protected List<ReactPackage> getPackages() {
    List<ReactPackage> packages = new PackageList(this).getPackages();
    // ... your other packages
    packages.add(new OCIVoicePackage()); // Add this line
    return packages;
}
```

## Usage

```javascript
import OCIVoiceNative from 'react-native-oci-voice';

// Initialize the module
await OCIVoiceNative.initialize({
  region: 'eu-amsterdam-1'
});

// Set up callbacks
OCIVoiceNative.setOnSpeechStart(() => {
  console.log('Speech recognition started');
});

OCIVoiceNative.setOnSpeechResults((results) => {
  console.log('Speech recognition results:', results);
});

// Start listening
await OCIVoiceNative.startListening({
  token: 'your-oci-token',
  compartmentId: 'your-compartment-id'
});

// Stop listening
await OCIVoiceNative.stopListening();
```

## API

### Methods

- `initialize(config)`: Initialize the module with configuration options
- `startListening(options)`: Start listening for speech
- `stopListening()`: Stop listening for speech
- `destroy()`: Clean up resources

### Callbacks

- `setOnSpeechStart(callback)`: Set the callback for speech start events
- `setOnSpeechEnd(callback)`: Set the callback for speech end events
- `setOnSpeechResults(callback)`: Set the callback for speech results events
- `setOnSpeechPartialResults(callback)`: Set the callback for speech partial results events
- `setOnSpeechError(callback)`: Set the callback for speech error events
- `setOnSpeechVolumeChanged(callback)`: Set the callback for speech volume changed events

## License

MIT
