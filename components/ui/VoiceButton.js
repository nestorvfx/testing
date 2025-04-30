import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, View, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Voice from '@react-native-voice/voice';

const VoiceButton = ({ onSpeechResult, isActive, onToggleActive }) => {
  const [isListening, setIsListening] = useState(false);
  const [speechText, setSpeechText] = useState('');
  const [error, setError] = useState('');
  const [isAvailable, setIsAvailable] = useState(false); // Start with false until verified

  // Check if we're running in a development build with native modules
  useEffect(() => {
    const checkVoiceAvailability = async () => {
      try {
        // Check if Voice module is fully available
        if (Voice && typeof Voice.isAvailable === 'function') {
          const available = await Voice.isAvailable();
          console.log('Speech recognition availability:', available);
          setIsAvailable(available);
        } else {
          console.log('Voice module is not properly initialized');
          setIsAvailable(false);
        }
      } catch (e) {
        console.error('Error checking voice availability:', e);
        setIsAvailable(false);
      }
    };

    checkVoiceAvailability();
  }, []);

  // Set up speech recognition when available
  useEffect(() => {
    if (!isAvailable) return;

    // Set up event handlers
    Voice.onSpeechStart = onSpeechStart;
    Voice.onSpeechRecognized = onSpeechRecognized;
    Voice.onSpeechEnd = onSpeechEnd;
    Voice.onSpeechError = onSpeechError;
    Voice.onSpeechResults = onSpeechResults;
    Voice.onSpeechPartialResults = onSpeechPartialResults;
    Voice.onSpeechVolumeChanged = onSpeechVolumeChanged;

    // Clean up listeners when component unmounts
    return () => {
      if (isAvailable) {
        Voice.destroy().then(Voice.removeAllListeners);
      }
    };
  }, [isAvailable]);

  // Handle speech recognition events
  const onSpeechStart = () => {
    console.log('Speech started');
    setSpeechText('');
    setError('');
  };
  
  const onSpeechRecognized = (e) => {
    console.log('Speech recognized event:', e);
  };

  const onSpeechEnd = () => {
    console.log('Speech ended');
    
    // Small delay to ensure we get final results
    setTimeout(() => {
      if (speechText) {
        console.log('Sending speech result:', speechText);
        onSpeechResult(speechText);
      }
      setIsListening(false);
    }, 300);
  };

  const onSpeechResults = (event) => {
    if (event.value && event.value.length > 0) {
      const recognizedText = event.value[0];
      console.log('Speech recognized:', recognizedText);
      setSpeechText(recognizedText);
    }
  };
  
  const onSpeechPartialResults = (event) => {
    if (event.value && event.value.length > 0) {
      const partialText = event.value[0];
      console.log('Partial result:', partialText);
      if (partialText.length > 3 && (!speechText || partialText.length > speechText.length)) {
        setSpeechText(partialText);
      }
    }
  };
  
  const onSpeechVolumeChanged = (event) => {
    if (Platform.OS === 'android') {
      console.log('Speech volume:', event.value);
    }
  };

  const onSpeechError = (event) => {
    console.error('Speech recognition error:', event);
    const errorMessage = event.error?.message || 'Recognition failed';
    setError(`Error: ${errorMessage}`);
    setIsListening(false);
    
    // Log detailed error information to help with debugging
    console.error('Speech recognition error details:', JSON.stringify(event));
    
    if (errorMessage.includes('permission') || errorMessage.includes('access')) {
      Alert.alert(
        'Permission Error', 
        'Microphone access is required for voice recognition. Please enable it in your device settings.',
        [{ text: 'OK' }]
      );
    }
  };

  // Handle permission request directly through Voice module
  const requestVoicePermission = async () => {
    try {
      // Voice.start() will automatically request permissions on Android
      // For iOS, the permissions are requested when needed
      return true;
    } catch (e) {
      console.error('Error requesting voice permission:', e);
      return false;
    }
  };

  // Toggle listening state
  const toggleListening = async () => {
    if (!isActive) {
      onToggleActive(); // Prompt to activate if not active
      return;
    }
    
    // Check if voice recognition is available
    if (!isAvailable) {
      Alert.alert(
        'Voice Recognition Unavailable',
        'Voice recognition requires a development build. This feature is not available in Expo Go.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      if (isListening) {
        await stopListening();
      } else {
        // Voice module will handle permission requests internally
        const hasPermission = await requestVoicePermission();
        if (!hasPermission) return;
        
        setIsListening(true);
        setSpeechText('');
        setError('');
        
        // Start voice recognition with locale
        await Voice.start('en-US');
      }
    } catch (e) {
      console.error('Voice recognition error:', e);
      setError(`Error: ${e.message}`);
      setIsListening(false);
      
      Alert.alert(
        'Voice Recognition Error', 
        'Failed to start voice recognition. Please check permissions and try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Stop listening
  const stopListening = async () => {
    if (!isAvailable) return;
    
    try {
      await Voice.stop();
      setIsListening(false);
    } catch (e) {
      console.error('Error stopping voice recognition:', e);
    }
  };

  // Determine the button icon based on active and listening states
  const getButtonIcon = () => {
    if (!isAvailable) return "mic-off";
    if (!isActive) return "mic-off";
    if (isListening) return "mic";
    return "mic-outline";
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isActive ? styles.active : styles.inactive,
        isListening && styles.listening,
        !isAvailable && styles.unavailable
      ]}
      onPress={toggleListening}
      activeOpacity={0.7}
      disabled={!isAvailable}
    >
      {isListening ? (
        <View style={styles.listeningContainer}>
          <Ionicons name="mic" size={22} color="#fff" />
          <ActivityIndicator size="small" color="#fff" style={styles.indicator} />
        </View>
      ) : (
        <Ionicons name={getButtonIcon()} size={22} color={isActive && isAvailable ? "#fff" : "#999"} />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  active: {
    backgroundColor: '#6A1B9A',
  },
  inactive: {
    backgroundColor: '#f0f0f0',
  },
  listening: {
    backgroundColor: '#e91e63',
  },
  listeningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    marginLeft: 5,
  },
  unavailable: {
    backgroundColor: '#ccc',
    opacity: 0.7,
  }
});

export default VoiceButton;
