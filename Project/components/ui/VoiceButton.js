import React, { useState, useEffect, useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, View, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import VoiceService from '../../services/voiceService';
import { testMicrophone, fixAndroidAudioIssues } from '../../services/androidAudioFix';

// Simple console logger
const logDebug = (message) => {
  if (__DEV__) console.debug(`[VoiceButton] ${message}`);
};

const logInfo = (message) => {
  if (__DEV__) console.info(`[VoiceButton] ${message}`);
};

const logError = (message) => {
  console.error(`[VoiceButton] ERROR: ${message}`);
};

const logWarn = (message) => {
  console.warn(`[VoiceButton] WARN: ${message}`);
};

const logEvent = (event) => {
  if (__DEV__) console.info(`[VoiceButton] Event: ${event}`);
};

const VoiceButton = ({ onSpeechResult, isActive, onToggleActive, isAnalyzing = false, onError = null }) => {
  // State
  const [isListening, setIsListening] = useState(false);
  const [volume, setVolume] = useState(0);
  const [inCooldown, setInCooldown] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isPaused, setIsPaused] = useState(false); // Added for silent period pause
  
  // Track speech text with a ref to avoid state update timing issues
  const speechTextRef = useRef('');
  
  // Track errors and cooldown
  const errorCountRef = useRef(0);
  const cooldownTimerRef = useRef(null);
  const consecutiveErrorsRef = useRef(0);  // Add more sophisticated de-duplication for speech results
  const lastResultTimeRef = useRef(0);
  const lastResultTextRef = useRef('');
  const resultDedupeTimeMs = 5000; // Increase to 5 seconds for better de-duplication
  const pendingResultsRef = useRef({ 
    recent: [], 
    timeout: null, 
    lastPartial: '',
    newerResult: false,
    processingFinal: false,
    pendingResults: [] // Add this to store multiple pending results
  }); 
  const resultWaitTimeMs = 1200; // Increased wait time before processing a final result
    // Add silent period detection with different timers for brief silence vs long silence
  const lastActivityTimeRef = useRef(Date.now());
  const silenceTimerRef = useRef(null);
  const briefSilenceTimerRef = useRef(null);
  const silenceDurationMs = 10000; // 10 seconds of silence before pausing
  const briefSilenceDurationMs = 2000; // 2 seconds of silence to finalize speech
    // Flag for restart after error (rather than silence)
  const isErrorRestartRef = useRef(false);
  
  // Initialize pending results tracking
  pendingResultsRef.current = pendingResultsRef.current || { recent: [], timeout: null };
  
  // Start voice recognition on component mount if active
  useEffect(() => {
    // Check if microphone is available or help user with setup
    const checkVoiceAvailability = async () => {
      try {
        logDebug('Checking voice recognition availability');
        const available = await VoiceService.requestMicrophonePermission();
        logInfo(`Voice recognition available: ${!!available}`);
        
        if (available && Platform.OS === 'android') {
          // Preemptively try to fix common Android audio issues
          try {
            logDebug('Preemptively fixing audio issues');
            const result = await fixAndroidAudioIssues();
            logInfo(`Audio fix result: ${result.message}`);
          } catch (err) {
            logError(`Failed to apply audio fixes: ${err.message}`);
          }
        }
      } catch (e) {
        logError('Error checking voice availability', e.message);
      }
    };
    
    checkVoiceAvailability();
    
    return () => {
      cleanupVoiceService();
    };
  }, []);
    // Effect to handle setting up the voice service
  useEffect(() => {
    logDebug('Setting up voice recognition service');
    
    if (isActive) {
      startVoiceRecognition();
    } else {
      // Only stop if we were already listening - don't disable unnecessarily
      if (isListening) {
        stopVoiceRecognition();
      }
    }
    
    return () => {
      cleanupVoiceService();
    };
  }, [isActive]);
    // Clean up voice service
  const cleanupVoiceService = async () => {
    try {
      if (isListening) {
        logDebug('Cleanup: stopping listening');
        await VoiceService.stop();
        setIsListening(false);
      }
      
      // Stop all timers
      stopSilenceTimer();
      stopBriefSilenceTimer();
      
      logDebug('Cleanup: destroying voice service');
      // Don't call destroy() as it might interfere with future instances
      // Just make sure we're stopped
    } catch (error) {
      // Ignore cleanup errors
    }
  };
  // Toggle voice recognition
  const toggleVoiceRecognition = async () => {
    if (inCooldown) {
      return;
    }
    
    // Allow toggling even during analysis
    if (isActive) {
      // Already active, toggle off
      onToggleActive();
      await stopVoiceRecognition();
    } else if (isPaused) {
      // Resume from paused state
      resumeVoiceRecognition();
      onToggleActive();
    } else {
      // Not active, toggle on
      onToggleActive();
      // Voice recognition will be started by the effect
    }
  };
  // Start voice recognition
  const startVoiceRecognition = async () => {
    if (isListening || inCooldown || isAnalyzing) {
      return;
    }
    
    try {
      // Reset state for new session
      setErrorMessage('');
      
      // We don't want to reset speechTextRef.current here anymore
      // because we want to keep the accumulated text across restarts
      // Only reset if we previously had an error
      if (isErrorRestartRef.current) {
        speechTextRef.current = '';
        isErrorRestartRef.current = false;
      }
      
      setIsPaused(false);
      
      // Reset the silence-processed flag and pending results for a fresh start
      pendingResultsRef.current.silenceProcessed = false;
      pendingResultsRef.current.pendingResults = [];
      pendingResultsRef.current.processingFinal = false;
      pendingResultsRef.current.lastPartial = '';
      
      // Reset error counters
      consecutiveErrorsRef.current = 0;
      
      // Set up event handlers
      VoiceService.onSpeechStart = handleSpeechStart;
      VoiceService.onSpeechEnd = handleSpeechEnd;
      VoiceService.onSpeechResults = handleSpeechResults;
      VoiceService.onSpeechPartialResults = handleSpeechPartialResults;
      VoiceService.onSpeechError = handleSpeechError;
      VoiceService.onSpeechVolumeChanged = handleVolumeChanged;
      
      // Start listening
      await VoiceService.start('en-US');
      setIsListening(true);
      
      // Reset silence detection
      lastActivityTimeRef.current = Date.now();
      startSilenceTimer();
    } catch (error) {
      handleSpeechError({
        error: 'start_error',
        message: error.message
      });
    }
  };
  // Stop voice recognition
  const stopVoiceRecognition = async () => {
    if (!isListening) {
      return;
    }
    
    try {
      await VoiceService.stop();
    } catch (error) {
      // Ignore stop errors
    } finally {
      setIsListening(false);
      setVolume(0);
      stopSilenceTimer();
      stopBriefSilenceTimer();
      
      // Clear any pending speech results
      if (pendingResultsRef.current && pendingResultsRef.current.timeout) {
        clearTimeout(pendingResultsRef.current.timeout);
      }
    }
  };
  // Pause voice recognition after silence
  const pauseVoiceRecognition = async () => {
    if (!isListening) {
      return;
    }
    
    try {
      logInfo('Pausing voice recognition due to long silence');
      
      // We don't need to process speech here anymore since we now do it after brief silence
      // But still finalize any pending speech if it hasn't been done yet
      if (!pendingResultsRef.current.silenceProcessed) {
        finalizeSpeechAfterSilence();
      }
      
      await VoiceService.stop();
      setIsPaused(true);
      setIsListening(false);
      setVolume(0);
      stopSilenceTimer();
      stopBriefSilenceTimer();
    } catch (error) {
      // Ignore pause errors
    }
  };
    // Resume voice recognition after pause
  const resumeVoiceRecognition = async () => {
    if (isListening || inCooldown || isAnalyzing) {
      return;
    }
    
    try {
      logInfo('Resuming voice recognition');
      // Reset state for new session
      setErrorMessage('');
      speechTextRef.current = '';
      pendingResultsRef.current.silenceProcessed = false;
      
      // Start listening
      await VoiceService.start('en-US');
      setIsListening(true);
      setIsPaused(false);
      
      // Reset silence detection
      lastActivityTimeRef.current = Date.now();
      startSilenceTimer();
    } catch (error) {
      handleSpeechError({
        error: 'resume_error',
        message: error.message
      });
    }
  };
    // Start silence timer
  const startSilenceTimer = () => {
    stopSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      logInfo('Detected long silence period, pausing voice recognition');
      pauseVoiceRecognition();
    }, silenceDurationMs);
  };
  
  // Stop silence timer
  const stopSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };
  
  // Start brief silence timer for speech finalization
  const startBriefSilenceTimer = () => {
    stopBriefSilenceTimer();
    briefSilenceTimerRef.current = setTimeout(() => {
      logInfo('Detected brief silence, finalizing speech results');
      finalizeSpeechAfterSilence();
    }, briefSilenceDurationMs);
  };
  
  // Stop brief silence timer
  const stopBriefSilenceTimer = () => {
    if (briefSilenceTimerRef.current) {
      clearTimeout(briefSilenceTimerRef.current);
      briefSilenceTimerRef.current = null;
    }
  };
  // Finalize speech after a brief silence period
  const finalizeSpeechAfterSilence = () => {
    // Get all pending results
    const pendingResults = pendingResultsRef.current.pendingResults;
    
    // Mark that processing has been done to prevent duplicates
    pendingResultsRef.current.silenceProcessed = true;
    
    if (pendingResults.length > 0) {
      logInfo(`Finalizing ${pendingResults.length} pending speech result(s) after brief silence`);
      
      // Only process the last one - older ones should have been processed already
      const lastResult = pendingResults[pendingResults.length - 1];
      if (lastResult && !lastResult.processed) {
        // Mark as processed to avoid duplicate processing
        lastResult.processed = true;
        
        // Process the result immediately
        if (onSpeechResult) {
          logInfo(`Processing finalized speech result: "${lastResult.text}"`);
          onSpeechResult(lastResult.text, true, volume);
        }
      }
      
      // Clear the pending results after processing
      pendingResultsRef.current.pendingResults = [];
    } else {
      // If no pending results, check if we have any accumulated text to process
      const accumulatedText = speechTextRef.current;
      
      // Only finalize if we have meaningful text and it hasn't been finalized yet
      if (accumulatedText && accumulatedText.length > 3) {
        logInfo(`Finalizing accumulated speech after brief silence: "${accumulatedText}"`);
        
        // Process the result
        if (onSpeechResult) {
          onSpeechResult(accumulatedText, true, volume);
        }
      }
    }
  };
  
  // Get background color based on state
  const getBackgroundColor = () => {
    if (inCooldown) {
      return styles.cooldown.backgroundColor;
    }
    
    if (isAnalyzing) {
      return styles.disabled.backgroundColor;
    }
    
    if (isListening) {
      // If we're actively listening, use volume to adjust intensity
      // Map volume from 0-10 to a color intensity
      const baseColor = 29; // hue value for green
      const saturation = Math.min(100, 60 + volume * 4); // increase saturation with volume
      const lightness = Math.max(25, 50 - volume * 2); // decrease lightness with volume
      return `hsl(${baseColor}, ${saturation}%, ${lightness}%)`;
    }
    
    if (isActive) {
      return styles.active.backgroundColor;
    }
    
    return styles.button.backgroundColor;
  };
    // Test microphone functionality
  const handleLongPress = async () => {
    if (inCooldown || isTesting) {
      return;
    }
    
    setIsTesting(true);
    
    try {
      // Stop current recognition if active
      if (isListening) {
        await stopVoiceRecognition();
      }
      
      // Test microphone
      const testResult = await testMicrophone();
      
      // Show status to user
      if (testResult.working) {
        Alert.alert("Microphone Test", "Microphone is working correctly.");
      } else {
        Alert.alert(
          "Microphone Test Failed",
          `Reason: ${testResult.reason}\n${testResult.error || ''}`,
          [
            { text: "OK" },
            { 
              text: "Try to Fix",
              onPress: async () => {
                const fixResult = await fixAndroidAudioIssues();
                Alert.alert(
                  "Fix Result",
                  fixResult.fixed 
                    ? "Audio system fixed successfully! Try voice recognition again."
                    : `Failed to fix: ${fixResult.message}`
                );
              }
            }
          ]
        );
      }
    } catch (error) {
      Alert.alert("Microphone Test Error", error.message);
    } finally {
      setIsTesting(false);
      
      // Restart recognition if it was active
      if (isActive) {
        await startVoiceRecognition();
      }
    }
  };
    // Event Handlers
  const handleSpeechStart = (e) => {
    logEvent('onSpeechStart');
    setIsListening(true);
    lastActivityTimeRef.current = Date.now();
    startSilenceTimer();
    stopBriefSilenceTimer(); // Stop brief silence timer when speech starts
    
    // Reset the silence processed flag when new speech starts
    pendingResultsRef.current.silenceProcessed = false;
  };
  
  const handleSpeechEnd = (e) => {
    logEvent('onSpeechEnd');
    
    // Don't immediately stop listening - this allows for pauses between phrases
    // Speech end might just be a pause between sentences
    setVolume(0);
    
    // Start brief silence timer to detect end of speech segment
    startBriefSilenceTimer();
  };  const handleSpeechResults = (results) => {
    // Ensure results exist and have values
    if (!results || !results.value || results.value.length === 0) {
      logWarn('Received empty speech results');
      return;
    }
    
    // Get recognized text
    const recognizedText = results.value[0] || '';
    
    // Update ref
    speechTextRef.current = recognizedText;
    
    // Update activity timestamp and reset silence timers
    lastActivityTimeRef.current = Date.now();
    startSilenceTimer();
    
    // For final results, we don't immediately process them
    // Instead, we'll wait for a brief silence before finalizing
    if (results.isFinal) {
      logInfo(`Received final speech result: "${recognizedText}"`);
      
      // Check if the text is empty or too short
      if (!recognizedText || recognizedText.length < 3) {
        logInfo('Ignoring very short final result');
        return;
      }
      
      // Check if this result is similar to a recently processed one
      const currentTime = Date.now();
      if (isSimilarToRecentResult(recognizedText, currentTime)) {
        const timeSinceLast = currentTime - lastResultTimeRef.current;
        console.log(`Ignoring duplicate speech result: "${recognizedText}" received ${timeSinceLast}ms after previous`);
        return;
      }
      
      // Add to pending results queue instead of immediately processing
      const newResult = {
        text: recognizedText,
        timestamp: currentTime,
        processed: false
      };
      
      // Add to the queue of pending results
      pendingResultsRef.current.pendingResults.push(newResult);
      
      // Update tracking variables
      lastResultTimeRef.current = currentTime;
      lastResultTextRef.current = recognizedText;
      
      // Start brief silence timer to finalize after a pause in speech
      startBriefSilenceTimer();
    }
  };
    // Helper function to check if a result is similar to a recent one
  const isSimilarToRecentResult = (text, currentTime) => {
    // Initialize recent results array if not already
    if (!pendingResultsRef.current.recent) {
      pendingResultsRef.current.recent = [];
      return false;
    }
    
    // Filter to only include results within deduplication time window
    const recentResults = pendingResultsRef.current.recent.filter(
      item => currentTime - item.time < resultDedupeTimeMs
    );
    
    // No previous results to compare against
    if (recentResults.length === 0) {
      return false;
    }
    
    // Basic exact match check - definitely a duplicate
    if (recentResults.some(item => item.text === text)) {
      logInfo(`Exact match found for "${text}"`);
      return true;
    }
    
    // Check for substring or very similar phrases
    for (const item of recentResults) {
      // If one is a substring of the other with significant overlap
      if ((text.includes(item.text) && item.text.length > 10) || 
          (item.text.includes(text) && text.length > 10)) {
        logInfo(`Substring similarity detected between "${text}" and "${item.text}"`);
        return true;
      }
      
      // Simple edit distance check for similar phrases
      // This helps catch things like "What's next" vs "What's next?"
      const distance = levenshteinDistance(text.toLowerCase(), item.text.toLowerCase());
      const maxLength = Math.max(text.length, item.text.length);
      
      // If the strings are at least 90% similar (stricter threshold)
      if (distance / maxLength < 0.1) {
        logInfo(`Levenshtein similarity detected (${Math.round((1-(distance/maxLength))*100)}%) between "${text}" and "${item.text}"`);
        return true;
      }
    }
    
    return false;
  };
  
  // Levenshtein distance algorithm to measure text similarity
  const levenshteinDistance = (a, b) => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    
    const matrix = Array(a.length + 1).fill().map(() => Array(b.length + 1).fill());
    
    for (let i = 0; i <= a.length; i++) {
      matrix[i][0] = i;
    }
    
    for (let j = 0; j <= b.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    
    return matrix[a.length][b.length];
  };
  const handleSpeechPartialResults = (results) => {
    // Safety check
    if (!results || !results.value || results.value.length === 0) {
      return;
    }
    
    // Get partial text
    const partialText = results.value[0] || '';
    
    // Update ref
    speechTextRef.current = partialText;
    
    // Reset silence detection (this is speech activity)
    lastActivityTimeRef.current = Date.now();
    startSilenceTimer();
    stopBriefSilenceTimer(); // Reset brief silence timer because we have activity
    
    // If we have text and a callback, send the partial result
    // But only if it's substantially different from the last partial text
    // This prevents UI flickering with very similar partial results
    if (partialText && onSpeechResult && !results.isFinal && !pendingResultsRef.current.processingFinal) {
      // Only update UI with significantly different partial results
      const lastPartialText = pendingResultsRef.current.lastPartial || '';
      
      // Only update if the text is different enough (at least 5 characters different or not a substring)
      if (!lastPartialText || 
          Math.abs(partialText.length - lastPartialText.length) > 5 || 
          (!partialText.includes(lastPartialText) && !lastPartialText.includes(partialText))) {
        logDebug(`Partial speech result: "${partialText}"`);
        onSpeechResult(partialText, false, volume);
        pendingResultsRef.current.lastPartial = partialText;
      }
    }
  };
    const handleVolumeChanged = (e) => {
    if (e && typeof e.value !== 'undefined') {
      // Scale volume to 0-10 range
      const volumeLevel = Math.min(10, Math.floor(e.value * 10));
      setVolume(volumeLevel);
      
      // Only consider significant volume as speech activity
      if (volumeLevel > 2) {
        // Reset silence detection
        lastActivityTimeRef.current = Date.now();
        startSilenceTimer();
        stopBriefSilenceTimer(); // Reset brief silence timer on significant volume
      }
    }
  };  const handleSpeechError = (error) => {
    const errorMessage = error?.message || 'Unknown speech recognition error';
    
    // Check if this is a silence or timeout error - these are common and can be handled gracefully
    const isSilenceError = errorMessage.includes('silence') || 
                          errorMessage.includes('timeout') || 
                          errorMessage.includes('no match') ||
                          errorMessage.includes('no speech') ||
                          errorMessage === 'Unknown speech recognition error';
    
    if (isSilenceError) {
      // Handle silence errors by transitioning to paused state instead of error state
      logInfo(`Detected silence or timeout: ${errorMessage}`);
      
      // Check if we have pending results that we should process now
      if (pendingResultsRef.current.pendingResults && 
          pendingResultsRef.current.pendingResults.length > 0 &&
          !pendingResultsRef.current.silenceProcessed) {
        // Process pending results before pausing
        finalizeSpeechAfterSilence();
      } 
      // Also check for accumulated speech
      else if (speechTextRef.current && 
               speechTextRef.current.length > 3 && 
               !pendingResultsRef.current.silenceProcessed) {
        finalizeSpeechAfterSilence();
      }
      
      // Don't immediately pause on every silence error - only after multiple consecutive ones
      consecutiveErrorsRef.current += 1;
      
      if (consecutiveErrorsRef.current > 5) {
        pauseVoiceRecognition();
        // Reset counter after pausing
        consecutiveErrorsRef.current = 0;
      }
      return;
    }
      // For other errors, increment consecutive errors counter
    consecutiveErrorsRef.current += 1;
    isErrorRestartRef.current = true;
    
    // Update state
    setErrorMessage(errorMessage);
    setIsListening(false);
    
    // Notify parent component if error handler provided
    if (onError && typeof onError === 'function') {
      onError(error);
    }
    
    // Auto-restart on non-critical errors after a short delay
    if (consecutiveErrorsRef.current < 3 && isActive) {
      logInfo('Auto-restarting voice recognition after error');
      setTimeout(() => {
        startVoiceRecognition();
      }, 1500);
    }
    
    // Stop all silence timers
    stopSilenceTimer();
    stopBriefSilenceTimer();
    
    // Log the error
    logError(`Speech recognition error: ${errorMessage}`);
    
    // Implement adaptive backoff for errors
    const maxBackoff = 10000; // 10 seconds
    const baseBackoff = 1000; // 1 second
    const backoffTime = Math.min(maxBackoff, baseBackoff * Math.pow(1.5, consecutiveErrorsRef.current - 1));
    
    logInfo(`Setting error cooldown: ${backoffTime}ms, consecutive errors: ${consecutiveErrorsRef.current}`);
    
    // Set cooldown and auto-restart if errors are not too many
    setInCooldown(true);
    
    if (consecutiveErrorsRef.current < 3) {
      logInfo('Auto-restarting speech recognition after error');
      cooldownTimerRef.current = setTimeout(() => {
        setInCooldown(false);
        if (isActive) startVoiceRecognition();
      }, backoffTime);
    } else {
      logWarn(`Too many errors (${consecutiveErrorsRef.current}), delaying restart`);
      
      // If we've had many errors, give a longer timeout then try one more time
      cooldownTimerRef.current = setTimeout(() => {
        setInCooldown(false);
        if (isActive) {
          if (consecutiveErrorsRef.current < 5) {
            logInfo('Final restart attempt after multiple errors');
            startVoiceRecognition();
          } else {
            // Too many consecutive errors, transition to paused state rather than error
            logInfo('Too many errors, switching to paused state');
            setIsPaused(true);
            consecutiveErrorsRef.current = 0;
          }
        }
      }, backoffTime * 2);
    }
  };// Cleanup timers
  useEffect(() => {
    return () => {
      // Clean up all timers to prevent memory leaks
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (briefSilenceTimerRef.current) {
        clearTimeout(briefSilenceTimerRef.current);
      }
      if (pendingResultsRef.current && pendingResultsRef.current.timeout) {
        clearTimeout(pendingResultsRef.current.timeout);
      }
    };
  }, []);
    // Effect to prevent silence timer during analysis
  useEffect(() => {
    if (isAnalyzing) {
      // Stop silence detection during analysis to prevent interruption
      stopSilenceTimer();
      stopBriefSilenceTimer();
    } else if (isListening) {
      // Restart silence detection when analysis completes
      lastActivityTimeRef.current = Date.now();
      startSilenceTimer();
    }
  }, [isAnalyzing, isListening]);
  
  // Get status color and icon
  let statusColor = '#666';
  let micIconName = 'mic-outline';
  
  if (inCooldown) {
    statusColor = '#d9534f'; // Danger for cooldown
    micIconName = 'mic-off-outline';
  } else if (isAnalyzing) {
    statusColor = '#f0ad4e'; // Warning for analyzing
    micIconName = 'hourglass-outline';
  } else if (isListening) {
    statusColor = '#5cb85c'; // Success for listening
    micIconName = 'mic';
  } else if (isActive) {
    statusColor = '#5bc0de'; // Info for enabled but not listening
    micIconName = 'mic-outline';
  }
    return (
    <TouchableOpacity
      style={[
        styles.button,
        inCooldown && styles.cooldown,
        isActive && !isListening && styles.active,
        isListening && styles.listening,
        { backgroundColor: getBackgroundColor() }
      ]}
      onPress={toggleVoiceRecognition}
      onLongPress={handleLongPress}
      delayLongPress={1000}
      activeOpacity={0.7}
    >
      {isTesting ? (
        <ActivityIndicator color="#ffffff" size="small" />
      ) : (
        <>
          <Ionicons name={micIconName} size={22} color="white" />
          
          {/* Volume indicator (dots) when listening */}
          {isListening && (
            <View style={styles.volumeContainer}>
              {[...Array(5)].map((_, i) => (
                <View 
                  key={i} 
                  style={[
                    styles.volumeDot,
                    { opacity: i <= volume / 2 ? 0.9 : 0.3 }
                  ]} 
                />
              ))}
            </View>
          )}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(52, 73, 94, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
  },
  active: {
    backgroundColor: 'rgba(52, 152, 219, 0.8)',
  },
  listening: {
    backgroundColor: 'rgba(46, 204, 113, 0.8)',
  },
  disabled: {
    backgroundColor: 'rgba(149, 165, 166, 0.8)',
  },
  cooldown: {
    backgroundColor: 'rgba(231, 76, 60, 0.8)',
  },
  volumeContainer: {
    position: 'absolute',
    bottom: -10,
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    height: 4,
  },
  volumeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'white',
    marginHorizontal: 1,
  },
});

export default VoiceButton;

// Add a function to manage speech result deduplication more effectively
const addSpeechResultToQueue = (finalText) => {
  // Get current time for tracking
  const currentTime = Date.now();
  
  // Check if the result is too similar to a recent one
  if (isSimilarToRecentResult(finalText, currentTime)) {
    // Add logging to track this case
    const timeSinceLast = currentTime - lastResultTimeRef.current;
    console.log(`Ignoring duplicate speech result: "${finalText}" received ${timeSinceLast}ms after previous`);
    return false;
  }
  
  // Create a new result entry
  const newResult = {
    text: finalText,
    timestamp: currentTime,
    processed: false
  };
  
  // Initialize if needed
  if (!pendingResultsRef.current.pendingResults) {
    pendingResultsRef.current.pendingResults = [];
  }
  
  // Add to the queue of pending results
  pendingResultsRef.current.pendingResults.push(newResult);
  
  // Update tracking variables
  lastResultTimeRef.current = currentTime;
  lastResultTextRef.current = finalText;
  
  // Return true to indicate this is a new result
  return true;
};

// Add a more robust function to determine if results are similar
const areTextsSimilar = (text1, text2) => {
  // If the strings are identical or one is a subset of the other, they're similar
  if (text1 === text2 || text1.includes(text2) || text2.includes(text1)) {
    return true;
  }
  
  // Calculate Levenshtein distance to see how different they are
  const distance = levenshteinDistance(text1, text2);
  
  // If they're very similar (low edit distance relative to length), consider them similar
  const maxLength = Math.max(text1.length, text2.length);
  const normalizedDistance = distance / maxLength;
  
  // If more than 80% similar, consider them the same
  return normalizedDistance < 0.2;
};
