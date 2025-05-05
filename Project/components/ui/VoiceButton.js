import React, { useState, useEffect, useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, View, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import VoiceService from '../../services/voiceService';

const VoiceButton = ({ onSpeechResult, isActive, onToggleActive, isAnalyzing = false }) => {
  const [isListening, setIsListening] = useState(false);
  const [speechText, setSpeechText] = useState('');
  const [error, setError] = useState('');
  const [isAvailable, setIsAvailable] = useState(false);
  const [volume, setVolume] = useState(0);
  
  // Silence detection and error handling
  const silenceTimeoutRef = useRef(null);
  const lastSpeechTimestampRef = useRef(null);
  const [inCooldown, setInCooldown] = useState(false);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const restartTimerRef = useRef(null);
  const SILENCE_DURATION = 2000;
  const COOLDOWN_PERIOD = 1500;
  const MAX_CONSECUTIVE_ERRORS = 5;

  // Check availability on mount
  useEffect(() => {
    const checkVoiceAvailability = async () => {
      try {
        const available = await VoiceService.isAvailable();
        setIsAvailable(available);
      } catch (e) {
        setIsAvailable(false);
      }
    };

    checkVoiceAvailability();
  }, []);

  // Set up speech recognition
  useEffect(() => {
    if (!isAvailable) return;

    VoiceService.setup();
    VoiceService.onSpeechStart = onSpeechStart;
    VoiceService.onSpeechEnd = onSpeechEnd;
    VoiceService.onSpeechResults = onSpeechResults;
    VoiceService.onSpeechPartialResults = onSpeechPartialResults;
    VoiceService.onSpeechVolumeChanged = onSpeechVolumeChanged;
    VoiceService.onSpeechError = onSpeechError;

    return () => {
      if (isListening) {
        stopListening().catch(() => {});
      }
      
      if (isAvailable) {
        VoiceService.destroy();
      }
      
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    };
  }, [isAvailable]);

  // Handle active state changes
  useEffect(() => {
    if (isActive && isAvailable && Platform.OS === 'android' && !isListening && !inCooldown && !isAnalyzing) {
      startListening().catch(() => {});
    } else if (!isActive && isListening) {
      stopListening().catch(() => {});
    }
  }, [isActive, isAvailable, isListening, inCooldown]);

  // Handle analysis state
  useEffect(() => {
    if (isAnalyzing && isListening) {
      stopListening().catch(() => {});
    } else if (!isAnalyzing && isActive && !isListening && isAvailable && 
              Platform.OS === 'android' && !inCooldown) {
      startListening().catch(() => {});
    }
  }, [isAnalyzing, isActive, isListening, inCooldown]);

  // Reset state
  const resetState = () => {
    setError('');
    setSpeechText('');
    setVolume(0);
    
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  };

  // Speech event handlers
  const onSpeechStart = (e) => {
    setError('');
    lastSpeechTimestampRef.current = Date.now();
    setConsecutiveErrors(0);
    
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  };

  const onSpeechEnd = (e) => {
    if (isAnalyzing) return;
    
    silenceTimeoutRef.current = setTimeout(() => {
      if (speechText && !isAnalyzing) {
        onSpeechResult(speechText, true, 0);
        setSpeechText('');
        
        setTimeout(() => {
          if (isActive && !isAnalyzing && !isListening && !inCooldown) {
            startListening().catch(() => {});
          }
        }, 1000);
      }
    }, SILENCE_DURATION);
  };

  const onSpeechResults = (e) => {
    lastSpeechTimestampRef.current = Date.now();
    
    if (e.value && e.value.length > 0) {
      const recognizedText = e.value[0];
      setSpeechText(recognizedText);
    }
  };
  
  const onSpeechPartialResults = (e) => {
    lastSpeechTimestampRef.current = Date.now();
    
    if (e.value && e.value.length > 0) {
      const partialText = e.value[0];
      if (partialText.length > 3 && (!speechText || partialText.length > speechText.length)) {
        setSpeechText(partialText);
      }
    }
  };
  
  const onSpeechVolumeChanged = (e) => {
    if (Platform.OS === 'android' && e && e.value !== undefined) {
      const normalizedVolume = Math.min(e.value * 10, 100);
      setVolume(normalizedVolume);
      
      if (speechText && onSpeechResult) {
        onSpeechResult(speechText, false, normalizedVolume);
      }
    }
  };

  const onSpeechError = (e) => {
    setConsecutiveErrors(prev => prev + 1);
    
    const isCommonError = e.error && (
      e.error.code === 7 || 
      e.error.code === 5
    );
    
    if (isCommonError) {
      setInCooldown(true);
      setIsListening(false);
      
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
      }
      
      const backoffTime = Math.min(COOLDOWN_PERIOD * Math.pow(1.5, Math.min(consecutiveErrors, 4)), 10000);
      
      restartTimerRef.current = setTimeout(() => {
        setInCooldown(false);
        if (isActive && !isAnalyzing && consecutiveErrors < MAX_CONSECUTIVE_ERRORS) {
          startListening().catch(() => {
            setTimeout(() => setInCooldown(false), 3000);
          });
        } else if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          setTimeout(() => setConsecutiveErrors(0), 15000);
        }
      }, backoffTime);
      
      return;
    }
    
    setError('Recognition error. Restarting...');
    setIsListening(false);
    
    setTimeout(() => {
      if (isActive && !isAnalyzing && isAvailable && Platform.OS === 'android') {
        startListening().catch(() => {});
      }
    }, 1000);
  };

  // Start listening
  const startListening = async () => {
    if (!isAvailable || isAnalyzing || inCooldown || isListening) {
      return;
    }
    
    resetState();
    setIsListening(true);
    
    try {
      await VoiceService.start('en_US');
    } catch (e) {
      setError(`Error: ${e.message || 'Unknown error'}`);
      setIsListening(false);
      
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
      
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
    } catch (e) {
      // Error stopping
    }
  };

  // Toggle active state
  const toggleActive = () => {
    if (Platform.OS !== 'android') {
      Alert.alert(
        'Not Available',
        'Voice recognition is currently only supported on Android devices.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (!isAvailable) {
      Alert.alert(
        'Voice Recognition Unavailable',
        'Voice recognition service is not available on this device.',
        [{ text: 'OK' }]
      );
      return;
    }

    onToggleActive();
  };

  // Button icon and style getters
  const getButtonIcon = () => {
    if (!isAvailable || Platform.OS !== 'android') return "mic-off";
    if (!isActive) return "mic-off";
    if (inCooldown) return "mic-outline";
    if (isListening) return "mic";
    return "mic-outline";
  };

  const getButtonStyle = () => {
    if (!isAvailable || Platform.OS !== 'android') return styles.unavailable;
    if (!isActive) return styles.inactive;
    if (isAnalyzing) return styles.analyzing;
    if (inCooldown) return styles.cooldown;
    if (isListening) return styles.listening;
    return styles.active;
  };

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
      
      {onSpeechResult && isListening && speechText && onSpeechResult(speechText, false, volume)}
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
  analyzing: {
    backgroundColor: '#FF9800',
  },
  cooldown: {
    backgroundColor: '#9C27B0',
    opacity: 0.6,
  },
  listeningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cooldownContainer: {
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
