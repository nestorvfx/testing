import React, { useState, useEffect, useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, View, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import VoiceService from '../../services/voiceService';

const VoiceButton = ({ onSpeechResult, isActive, onToggleActive, isAnalyzing = false }) => {
  const [isListening, setIsListening] = useState(false);
  const [speechText, setSpeechText] = useState('');
  const [error, setError] = useState('');
  const [isAvailable, setIsAvailable] = useState(false);
  const [recognized, setRecognized] = useState('');
  const [pitch, setPitch] = useState('');
  const [end, setEnd] = useState('');
  const [volume, setVolume] = useState(0);
  
  // Add silence detection refs
  const silenceTimeoutRef = useRef(null);
  const lastSpeechTimestampRef = useRef(null);
  const SILENCE_DURATION = 2000; // 2 seconds of silence before auto-capture

  // Add cooldown state
  const [inCooldown, setInCooldown] = useState(false);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const restartTimerRef = useRef(null);
  const COOLDOWN_PERIOD = 1500; // 1.5 seconds between restart attempts
  const MAX_CONSECUTIVE_ERRORS = 5;

  // Check if voice recognition is available
  useEffect(() => {
    const checkVoiceAvailability = async () => {
      try {
        const available = await VoiceService.isAvailable();
        console.log('Speech recognition availability:', available);
        setIsAvailable(available);
        
        // On non-Android platforms, we need to show a platform compatibility message
        if (!available && Platform.OS !== 'android') {
          console.log('Speech recognition is only available on Android');
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
    VoiceService.setup();
    VoiceService.onSpeechStart = onSpeechStart;
    VoiceService.onSpeechEnd = onSpeechEnd;
    VoiceService.onSpeechResults = onSpeechResults;
    VoiceService.onSpeechPartialResults = onSpeechPartialResults;
    VoiceService.onSpeechVolumeChanged = onSpeechVolumeChanged;
    VoiceService.onSpeechError = onSpeechError;

    // Clean up listeners when component unmounts
    return () => {
      if (isListening) {
        stopListening().catch(e => console.error('Error stopping listening during cleanup:', e));
      }
      
      if (isAvailable) {
        VoiceService.destroy();
      }
      
      // Clear any pending timeouts
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    };
  }, [isAvailable]);

  // Add effect to start/stop listening based on isActive state
  useEffect(() => {
    if (isActive && isAvailable && Platform.OS === 'android') {
      // Start listening when activated
      startListening().catch(e => console.error('Error starting automatic listening:', e));
    } else if (!isActive && isListening) {
      // Stop listening when deactivated
      stopListening().catch(e => console.error('Error stopping listening on deactivation:', e));
    }
  }, [isActive, isAvailable]);

  // Add effect to handle analysis state
  useEffect(() => {
    // Pause listening during analysis
    if (isAnalyzing && isListening) {
      console.log('Pausing speech recognition during analysis');
      stopListening().catch(e => console.error('Error stopping during analysis:', e));
    } 
    // Resume listening after analysis if active, not in cooldown, and not listening yet
    else if (!isAnalyzing && isActive && !isListening && isAvailable && 
             Platform.OS === 'android' && !inCooldown) {
      console.log('Resuming speech recognition after analysis');
      startListening().catch(e => console.error('Error resuming after analysis:', e));
    }
  }, [isAnalyzing, isActive, isListening, inCooldown]);

  // Effect to start/stop listening when isActive changes
  useEffect(() => {
    // When button becomes active, start listening
    if (isActive && isAvailable && Platform.OS === 'android' && !isListening && !isAnalyzing) {
      console.log('VoiceButton activated - starting initial listening');
      startListening().catch(e => console.error('Error starting listening on activation:', e));
    } 
    // When button becomes inactive, stop listening
    else if (!isActive && isListening) {
      console.log('VoiceButton deactivated - stopping listening');
      stopListening().catch(e => console.error('Error stopping listening on deactivation:', e));
    }
  }, [isActive, isAvailable]); // Only depend on these props, not listening state

  // Separate effect to handle analysis state
  useEffect(() => {
    // Pause listening during analysis
    if (isAnalyzing && isListening) {
      console.log('Pausing speech recognition during analysis');
      stopListening().catch(e => console.error('Error stopping during analysis:', e));
    } 
    // Resume listening after analysis if button is still active
    else if (!isAnalyzing && isActive && !isListening && isAvailable && Platform.OS === 'android') {
      console.log('Resuming speech recognition after analysis');
      startListening().catch(e => console.error('Error resuming after analysis:', e));
    }
  }, [isAnalyzing, isActive]);

  // Reset all state values
  const resetState = () => {
    setRecognized('');
    setPitch('');
    setError('');
    setEnd('');
    setSpeechText('');
    setVolume(0);
    // Keep isListening as is, will be set separately
    
    // Clear any pending timeouts
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  };

  // Handle speech recognition events
  const onSpeechStart = (e) => {
    console.log('Speech started', e);
    setEnd('');
    setError('');
    setConsecutiveErrors(0); // Reset error count when speech starts successfully
    lastSpeechTimestampRef.current = Date.now();
    
    // Clear any pending silence timeouts since speech has started
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  };
  
  const onSpeechRecognized = (e) => {
    console.log('Speech recognized event:', e);
    setRecognized('√');
    lastSpeechTimestampRef.current = Date.now();
  };

  const onSpeechEnd = (e) => {
    console.log('Speech ended', e);
    setEnd('√');
    
    // Only proceed with auto-capture if we're not analyzing
    if (isAnalyzing) {
      console.log('Analysis in progress, speech capture prevented');
      return;
    }
    
    // Set up a timeout to capture after silence
    silenceTimeoutRef.current = setTimeout(() => {
      if (speechText && !isAnalyzing) { // Double-check not analyzing
        console.log('Auto-capturing after silence:', speechText);
        
        // Pass the final speech text to parent with volume=0 since speech ended
        onSpeechResult(speechText, true, 0);
        setSpeechText('');
        
        // Restart listening after processing with a delay to avoid overlapping processes
        setTimeout(() => {
          if (isActive && !isAnalyzing && !isListening) {
            console.log('Restarting listening after auto-capture');
            startListening().catch(err => 
              console.error('Error restarting listening after capture:', err)
            );
          }
        }, 1000);
      }
    }, SILENCE_DURATION);
  };

  const onSpeechResults = (e) => {
    console.log('Speech results:', e);
    lastSpeechTimestampRef.current = Date.now();
    
    if (e.value && e.value.length > 0) {
      const recognizedText = e.value[0];
      console.log('Speech recognized:', recognizedText);
      setSpeechText(recognizedText);
    }
  };
  
  const onSpeechPartialResults = (e) => {
    console.log('Partial result:', e);
    lastSpeechTimestampRef.current = Date.now();
    
    if (e.value && e.value.length > 0) {
      const partialText = e.value[0];
      // Only update the speechText if it's significantly different
      if (partialText.length > 3 && (!speechText || partialText.length > speechText.length)) {
        setSpeechText(partialText);
      }
    }
  };
  
  const onSpeechVolumeChanged = (e) => {
    // Update volume for the wave visualization
    if (Platform.OS === 'android' && e && e.value !== undefined) {
      // Scale from 0-10 to 0-100 for the visualizer
      const normalizedVolume = Math.min(e.value * 10, 100);
      setVolume(normalizedVolume);
      setPitch(e.value);
      
      // Also pass volume to parent component for visualization
      if (speechText && onSpeechResult) {
        onSpeechResult(speechText, false, normalizedVolume);
      }
    }
  };

  const onSpeechError = (e) => {
    console.error('Speech recognition error:', e);
    
    // We only care about tracking true errors, not normal recognition failures
    const isBenignError = e && e.error && (
      e.error.code === 7 || // No recognition matches - normal
      e.error.code === 5    // Client side error - usually temporary
    );

    if (isBenignError) {
      // For benign errors, silently restart if still active
      console.log(`Common error (code ${e.error ? e.error.code : 'unknown'}), handling silently`);
      setIsListening(false);
      
      // Short delay before restarting
      setTimeout(() => {
        if (isActive && !isAnalyzing && isAvailable && Platform.OS === 'android') {
          console.log('Auto-restarting after benign error');
          startListening().catch(e => {
            console.error('Error restarting listening after benign error:', e);
          });
        }
      }, 300);
      return;
    }
    
    // For serious errors, try to restart but show the error
    setError('Recognition error. Restarting...');
    setIsListening(false);
    
    // Try to restart after a short delay
    setTimeout(() => {
      if (isActive && !isAnalyzing && isAvailable && Platform.OS === 'android') {
        console.log('Restarting listening after error');
        startListening().catch(e => {
          console.error('Error restarting listening after error:', e);
        });
      }
    }, 1000);
  };

  // Start recognition with additional safeguards
  const startListening = async () => {
    if (!isAvailable || isAnalyzing || inCooldown) {
      console.log(`Cannot start listening - available: ${isAvailable}, analyzing: ${isAnalyzing}, cooldown: ${inCooldown}`);
      return;
    }
    
    // Prevent multiple simultaneous start attempts
    if (isListening) {
      console.log('Already listening, skipping start attempt');
      return;
    }
    
    resetState();
    setIsListening(true);
    
    try {
      await VoiceService.start('en_US');
    } catch (e) {
      console.error('Error starting voice recognition:', e);
      setError(`Error: ${e.message || 'Unknown error'}`);
      setIsListening(false);
      
      // Don't show alerts for every restart attempt or common errors
      if (!e.message || (!e.message.includes('already started') && !e.message.includes('cooldown'))) {
        Alert.alert(
          'Voice Recognition Error', 
          'Failed to start voice recognition. Please try again.',
          [{ text: 'OK' }]
        );
      }
    }
  };

  // Stop listening
  const stopListening = async () => {
    if (!isAvailable) return;
    
    try {
      await VoiceService.stop();
      setIsListening(false);
      
      // Clear any pending timeouts
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
    } catch (e) {
      console.error('Error stopping voice recognition:', e);
    }
  };

  // Cancel listening
  const cancelListening = async () => {
    if (!isAvailable) return;
    
    try {
      await VoiceService.cancel();
      setIsListening(false);
      
      // Clear any pending timeouts
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
    } catch (e) {
      console.error('Error canceling voice recognition:', e);
    }
  };

  // Toggle active state instead of listening state
  const toggleActive = async () => {
    // Platform-specific message for non-Android devices
    if (Platform.OS !== 'android') {
      Alert.alert(
        'Not Available',
        'Voice recognition is currently only supported on Android devices.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Check if voice recognition is available
    if (!isAvailable) {
      Alert.alert(
        'Voice Recognition Unavailable',
        'Voice recognition service is not available on this device.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Toggle the active state via parent's callback
    onToggleActive();
  };

  // Determine the button icon and style based on active, listening, and cooldown states
  const getButtonIcon = () => {
    if (!isAvailable || Platform.OS !== 'android') return "mic-off";
    if (!isActive) return "mic-off";
    if (inCooldown) return "mic-outline"; // Use outline during cooldown
    if (isListening) return "mic";
    return "mic-outline";
  };

  // Visual indication of states
  const getButtonStyle = () => {
    if (!isAvailable || Platform.OS !== 'android') return styles.unavailable;
    if (!isActive) return styles.inactive;
    if (isAnalyzing) return styles.analyzing;
    if (inCooldown) return styles.cooldown;
    if (isListening) return styles.listening;
    return styles.active;
  };

  // Return the button based on platform and availability
  return (
    <TouchableOpacity
      style={[
        styles.container,
        getButtonStyle()
      ]}
      onPress={toggleActive}
      activeOpacity={0.7}
      disabled={!isAvailable && Platform.OS !== 'android'} 
    >
      {isListening ? (
        <View style={styles.listeningContainer}>
          <Ionicons name="mic" size={22} color="#fff" />
          <ActivityIndicator size="small" color="#fff" style={styles.indicator} />
        </View>
      ) : inCooldown ? (
        <View style={styles.cooldownContainer}>
          <Ionicons name="mic-outline" size={22} color="#fff" />
        </View>
      ) : (
        <Ionicons 
          name={getButtonIcon()} 
          size={22} 
          color={(isActive && isAvailable && Platform.OS === 'android') ? "#fff" : "#999"} 
        />
      )}
      
      {/* Export speech state for parent components with volume */}
      <React.Fragment>
        {onSpeechResult && isListening && speechText && onSpeechResult(speechText, false, volume)}
      </React.Fragment>
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
  },
  analyzing: {
    backgroundColor: '#FF9800', // Orange color for analyzing state
  },
  cooldown: {
    backgroundColor: '#9C27B0', // Purple with reduced opacity for cooldown
    opacity: 0.6,
  },
  cooldownContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default VoiceButton;
