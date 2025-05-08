import React, { useState, useEffect, useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, View, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import VoiceService from '../../services/voiceService';

const VoiceButton = ({ onSpeechResult, isActive, onToggleActive, isAnalyzing = false, onDebugInfo = () => {} }) => {
  // State
  const [isListening, setIsListening] = useState(false);
  const [volume, setVolume] = useState(0);
  const [inCooldown, setInCooldown] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Track speech text with a ref to avoid state update timing issues
  const [speechText, setSpeechText] = useState('');
  const speechTextRef = useRef('');
  
  // Speech tracking refs
  const lastSpeechTimestampRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const restartTimerRef = useRef(null);
  const speechDetectedRef = useRef(false);
  const isProcessingRef = useRef(false); // Add missing ref for processing state tracking
  
  // Error tracking
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [isAvailable, setIsAvailable] = useState(false);
  
  // Constants
  const SILENCE_DURATION = 1000; // Reduced from 2500
  const COOLDOWN_PERIOD = 1500;
  const MAX_CONSECUTIVE_ERRORS = 5;
  
  // When speech text changes, update the ref
  useEffect(() => {
    speechTextRef.current = speechText;
  }, [speechText]);

  // Prepare debug info
  useEffect(() => {
    onDebugInfo({
      isListening,
      speechText,
      volume,
      isActive,
      inCooldown,
      isAnalyzing,
      errorMessage,
      state: {
        speechDetected: speechDetectedRef.current,
        lastSpeechTimestamp: lastSpeechTimestampRef.current ? 
          new Date(lastSpeechTimestampRef.current).toLocaleTimeString() : null,
        silenceTimer: silenceTimerRef.current !== null,
        consecutiveErrors,
        isAvailable,
      }
    });
  }, [isListening, speechText, volume, isActive, inCooldown, isAnalyzing, errorMessage, consecutiveErrors, isAvailable, onDebugInfo]);

  // Report speech text to parent
  useEffect(() => {
    if (isListening && speechText && onSpeechResult) {
      onSpeechResult(speechText, false, volume);
    }
  }, [isListening, speechText, volume, onSpeechResult]);

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
      
      cleanupTimers();
    };
  }, [isAvailable]);

  // Handle active state changes
  useEffect(() => {
    let activationTimer;
    if (isActive && isAvailable && Platform.OS === 'android' && !isListening && !inCooldown && !isAnalyzing) {
      activationTimer = setTimeout(() => {
        startListening().catch((err) => {
          if (err?.message?.includes('cooldown')) {
            setInCooldown(true);
            setTimeout(() => setInCooldown(false), 3000);
          }
        });
      }, 300);
    } else if (!isActive && isListening) {
      stopListening().catch(() => {});
    }
    
    return () => {
      if (activationTimer) clearTimeout(activationTimer);
    };
  }, [isActive, isAvailable, isListening, inCooldown, isAnalyzing]);

  // Handle analysis state
  useEffect(() => {
    if (isAnalyzing && isListening) {
      stopListening().catch(() => {});
    } else if (!isAnalyzing && isActive && !isListening && isAvailable && 
              Platform.OS === 'android' && !inCooldown) {
      startListening().catch(() => {});
    }
  }, [isAnalyzing, isActive, isListening, inCooldown]);

  // Clean up all timers
  const cleanupTimers = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  };

  // Reset state
  const resetState = () => {
    setSpeechText('');
    speechTextRef.current = '';
    setVolume(0);
    speechDetectedRef.current = false;
    cleanupTimers();
  };

  // Fixed silence detection that always uses latest speech text
  const checkSilenceDuration = () => {
    if (!lastSpeechTimestampRef.current) return;
    
    const now = Date.now();
    const silenceDuration = now - lastSpeechTimestampRef.current;
    
    // Use ref for latest speech text value, not closure value
    const currentText = speechTextRef.current;
    
    console.log(`[VoiceButton] Checking silence: ${silenceDuration}ms / ${SILENCE_DURATION}ms needed, text="${currentText}"`);
    
    if (silenceDuration >= SILENCE_DURATION && currentText && currentText.trim().length > 0) {
      console.log(`[VoiceButton] Silence threshold reached (${silenceDuration}ms), processing speech: "${currentText}"`);
      processSpeechResult();
    } else {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      
      if (!currentText || currentText.trim().length === 0) {
        console.log('[VoiceButton] Waiting for speech to be detected');
      } else {
        console.log(`[VoiceButton] Not enough silence (${silenceDuration}ms), waiting for ${SILENCE_DURATION}ms`);
      }
      
      silenceTimerRef.current = setTimeout(checkSilenceDuration, 500);
    }
  };

  // Process the final speech result using the ref value
  const processSpeechResult = async () => {
    // Prevent multiple simultaneous processing
    if (isProcessingRef.current) {
      console.log(`[VoiceButton] Already processing speech, skipping duplicate call`);
      return;
    }
    
    // Always use the ref value for latest speech text
    const currentText = speechTextRef.current;
    
    if (!currentText || currentText.trim().length === 0 || isAnalyzing) {
      console.log(`[VoiceButton] Cannot process: speechText empty or analyzing=${isAnalyzing}`);
      return;
    }
    
    // Set processing flag to prevent duplicate captures
    isProcessingRef.current = true;
    
    console.log(`[VoiceButton] Processing final speech: "${currentText}"`);
    
    // Stop listening first
    try {
      console.log('[VoiceButton] Stopping listening');
      await stopListening();
    } catch (err) {
      console.log(`[VoiceButton] Error stopping recognition: ${err?.message}`);
    }
    
    // Set cooldown to prevent immediate restart
    setInCooldown(true);
    
    try {
      // Call the callback with the final speech result - using the FULL text
      console.log(`[VoiceButton] Submitting speech result for processing: "${currentText}"`);
      
      // This is the key line - we're passing the finalized flag as true
      if (onSpeechResult) {
        onSpeechResult(currentText, true, 0);
      }
    } catch (err) {
      console.log(`[VoiceButton] Error processing speech: ${err?.message}`);
    }
    
    // Reset for next listening
    resetState();
    
    // Resume listening after a short delay
    setTimeout(() => {
      console.log('[VoiceButton] Resuming listening after processing');
      setInCooldown(false);
      isProcessingRef.current = false; // Reset processing flag
      
      if (isActive && !isAnalyzing) {
        startListening().catch(() => {});
      }
    }, 1000);
  };

  // Speech event handlers
  const onSpeechStart = (e) => {
    lastSpeechTimestampRef.current = Date.now();
    setConsecutiveErrors(0);
    cleanupTimers();
  };

  const onSpeechEnd = (e) => {
    if (isAnalyzing) return;
    
    lastSpeechTimestampRef.current = Date.now();
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    silenceTimerRef.current = setTimeout(checkSilenceDuration, 500);
  };

  // Improved speech results handling for final results
  const onSpeechResults = (e) => {
    if (!e || !e.value || e.value.length === 0) return;
    
    lastSpeechTimestampRef.current = Date.now();
    
    // Check the raw value for debugging
    console.log(`[VoiceButton] Raw speech results value:`, e.value);
    
    // Extract text properly - e.value is an array of strings
    const results = Array.isArray(e.value) ? e.value : [e.value];
    console.log(`[VoiceButton] All speech results:`, results);
    
    // Get the first (best) result
    const recognizedText = results[0];
    
    if (recognizedText && recognizedText.trim().length > 0) {
      console.log(`[VoiceButton] Final speech result: "${recognizedText}"`);
      
      // Update both state and ref with the FULL text
      setSpeechText(recognizedText);
      speechTextRef.current = recognizedText;
      
      speechDetectedRef.current = true;
      
      // Process the result immediately
      processSpeechResult();
    }
  };
  
  // Modified to properly extract the full text
  const onSpeechPartialResults = (e) => {
    if (!e || !e.value || e.value.length === 0) return;
    
    lastSpeechTimestampRef.current = Date.now();
    
    // Check the raw value to debug
    console.log(`[VoiceButton] Raw partial results value:`, e.value);
    
    // Extract the text properly - e.value is an array of strings
    const partialText = Array.isArray(e.value) ? e.value[0] : e.value;
    
    console.log(`[VoiceButton] All partial results: "${partialText}"`);
    
    if (partialText && partialText.trim().length > 0) {
      // Make sure we're using the full string, not just the first character
      console.log(`[VoiceButton] Partial result: "${partialText}"`);
      
      // Update both state and ref with the FULL text
      setSpeechText(partialText);
      speechTextRef.current = partialText;
      
      speechDetectedRef.current = true;
      
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      silenceTimerRef.current = setTimeout(checkSilenceDuration, 500);
    }
  };

  const onSpeechVolumeChanged = (e) => {
    if (Platform.OS === 'android' && e && e.value !== undefined) {
      const normalizedVolume = Math.min(e.value * 10, 100);
      setVolume(normalizedVolume);
      
      if (Math.random() < 0.05) {
        console.log(`[VoiceButton] Volume: ${normalizedVolume.toFixed(0)}%`);
      }
      
      if (speechText && onSpeechResult) {
        onSpeechResult(speechText, false, normalizedVolume);
      }
    }
  };

  const onSpeechError = (e) => {
    setConsecutiveErrors(prev => prev + 1);
    
    const errorMessage = e.error ? 
      `Error ${e.error.code}: ${e.error.message || 'Unknown error'}` : 
      'Unknown error';
    
    console.log(`[VoiceButton] Speech error: ${errorMessage}`);
    setErrorMessage(errorMessage);
    
    // Handle any error - all errors should go through cooldown recovery
    console.log(`[VoiceButton] Error detected, entering cooldown`);
    setInCooldown(true);
    setIsListening(false);
    
    cleanupTimers();
    
    // Calculate backoff with limits
    const baseDelay = 1500; // 1.5 seconds base delay
    const maxDelay = 10000; // Maximum 10 second delay
    const backoffTime = Math.min(baseDelay * Math.pow(1.5, Math.min(consecutiveErrors, 4)), maxDelay);
    
    console.log(`[VoiceButton] Cooldown time: ${backoffTime}ms, consecutive errors: ${consecutiveErrors}`);
    
    restartTimerRef.current = setTimeout(() => {
      console.log('[VoiceButton] Cooldown complete');
      setInCooldown(false);
      // Only auto-restart if still active and not too many errors
      if (isActive && !isAnalyzing && consecutiveErrors < MAX_CONSECUTIVE_ERRORS) {
        console.log('[VoiceButton] Auto-restarting after cooldown');
        startListening().catch((err) => {
          console.log(`[VoiceButton] Failed to restart: ${err?.message}`);
          setTimeout(() => setInCooldown(false), 3000);
        });
      } else if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.log(`[VoiceButton] Too many errors (${consecutiveErrors}), pausing auto-restart`);
        // Reset error count after a longer timeout
        setTimeout(() => {
          console.log('[VoiceButton] Resetting error counter after timeout');
          setConsecutiveErrors(0);
          // Try one more restart if still active
          if (isActive && !isAnalyzing) {
            startListening().catch(() => {});
          }
        }, 15000);
      }
    }, backoffTime);
  };

  // Updated startListening with simpler options based on the guide
  const startListening = async () => {
    if (!isAvailable || isAnalyzing || inCooldown || isListening) {
      console.log(`[VoiceButton] Cannot start listening: available=${isAvailable}, analyzing=${isAnalyzing}, cooldown=${inCooldown}, listening=${isListening}`);
      return;
    }
    
    console.log('[VoiceButton] Starting listening');
    resetState();
    setIsListening(true);
    
    try {
      // Simplify options according to guide recommendations
      await VoiceService.start('en_US', {
        partialResults: true,
        maxResults: 5,
      });
      
      console.log('[VoiceButton] Listening started successfully');
    } catch (e) {
      console.log(`[VoiceButton] Error starting listening: ${e.message}`);
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

  const stopListening = async () => {
    if (!isAvailable) return;
    
    console.log('[VoiceButton] Stopping listening');
    try {
      await VoiceService.stop();
      console.log('[VoiceButton] Listening stopped successfully');
      setIsListening(false);
      cleanupTimers();
    } catch (e) {
      console.log(`[VoiceButton] Error stopping listening: ${e.message}`);
    }
  };

  const toggleActive = () => {
    console.log(`[VoiceButton] Toggle active: current=${isActive}`);
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

    console.log(`[VoiceButton] Toggling active state from ${isActive} to ${!isActive}`);
    onToggleActive();
  };

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
