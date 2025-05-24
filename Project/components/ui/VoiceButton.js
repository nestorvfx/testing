import React, { useState, useEffect, useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, View, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import VoiceService from '../../services/ociVoiceService';
import { testMicrophone, fixAndroidAudioIssues } from '../../services/androidAudioFix';

// Simple console logger - reduced logging
const logDebug = (message) => {
  // Debug logs removed
};

const logInfo = (message) => {
  // Info logs removed
};

const logError = (message) => {
  console.error(`[VoiceButton] ERROR: ${message}`);
};

const logWarn = (message) => {
  // Warning logs reduced to critical errors only
};

const logEvent = (event) => {
  // Event logs removed
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
  const consecutiveErrorsRef = useRef(0);  
  // Add more sophisticated de-duplication for speech results
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
  // Flag for restart after error
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
    console.log('[VOICE_BUTTON_DEBUG] isActive changed to:', isActive, 'isListening:', isListening);
    
    if (isActive) {
      console.log('[VOICE_BUTTON_DEBUG] Starting voice recognition due to isActive=true');
      startVoiceRecognition();
    } else {
      // Only stop if we were already listening - don't disable unnecessarily
      if (isListening) {
        console.log('[VOICE_BUTTON_DEBUG] Stopping voice recognition due to isActive=false');
        stopVoiceRecognition();
      } else {
        console.log('[VOICE_BUTTON_DEBUG] Not listening, no need to stop');
      }
    }
    
    return () => {
      console.log('[VOICE_BUTTON_DEBUG] Cleanup effect running');
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
      
      logDebug('Cleanup: destroying voice service');
      // Don't call destroy() as it might interfere with future instances
      // Just make sure we're stopped
    } catch (error) {
      // Ignore cleanup errors
    }
  };  // Toggle voice recognition
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
      // This was called before state change, which caused issues
      // onToggleActive();
    } else {
      // Not active, toggle on
      onToggleActive();
      // Voice recognition will be started by the effect
    }
  };  // Start voice recognition
  const startVoiceRecognition = async () => {
    console.log('[VOICE_BUTTON_DEBUG] startVoiceRecognition called. Current state:', {
      isListening, inCooldown, isAnalyzing
    });
    
    if (isListening || inCooldown || isAnalyzing) {
      console.log('[VOICE_BUTTON_DEBUG] Aborting start - already listening, in cooldown, or analyzing');
      return;
    }
    
    try {
      // Reset state for new session
      setErrorMessage('');
      console.log('[VOICE_BUTTON_DEBUG] Resetting speech state for new session');
      
      // Always reset the speech text when starting a new voice recognition session
      // This ensures we don't have stale text from a previous session
      speechTextRef.current = '';
      
      setIsPaused(false);
      
      // Reset the speech processing flags and pending results for a fresh start
      pendingResultsRef.current.silenceProcessed = false;
      pendingResultsRef.current.pendingResults = [];
      pendingResultsRef.current.processingFinal = false;
      pendingResultsRef.current.lastPartial = '';
      
      // Reset result tracking variables
      lastResultTextRef.current = '';
      lastResultTimeRef.current = 0;
      
      // Reset error counters
      consecutiveErrorsRef.current = 0;
      isErrorRestartRef.current = false;
      
      // Set up event handlers
      console.log('[VOICE_BUTTON_DEBUG] Setting up voice event handlers');
      VoiceService.onSpeechStart = handleSpeechStart;
      VoiceService.onSpeechEnd = handleSpeechEnd;
      VoiceService.onSpeechResults = handleSpeechResults;
      VoiceService.onSpeechPartialResults = handleSpeechPartialResults;
      VoiceService.onSpeechError = handleSpeechError;
      VoiceService.onSpeechVolumeChanged = handleVolumeChanged;
        
      // Start listening
      console.log('[VOICE_BUTTON_DEBUG] Calling VoiceService.start()');
      await VoiceService.start('en-US');
      console.log('[VOICE_BUTTON_DEBUG] VoiceService.start() completed successfully');
      setIsListening(true);
      console.log('[VOICE_BUTTON_DEBUG] isListening set to true');
    } catch (error) {
      console.error('[VOICE_BUTTON_DEBUG] Error starting voice recognition:', error.message, error.stack);
      handleSpeechError({
        error: 'start_error',
        message: error.message
      });
    }
  };
  // Stop voice recognition
  const stopVoiceRecognition = async () => {
    console.log('[VOICE_BUTTON_DEBUG] stopVoiceRecognition called. Current isListening:', isListening);
    if (!isListening) {
      console.log('[VOICE_BUTTON_DEBUG] Not listening, nothing to stop');
      return;
    }
    
    try {
      console.log('[VOICE_BUTTON_DEBUG] Calling VoiceService.stop()');
      await VoiceService.stop();
      console.log('[VOICE_BUTTON_DEBUG] VoiceService.stop() completed successfully');
    } catch (error) {
      console.error('[VOICE_BUTTON_DEBUG] Error stopping voice recognition:', error.message, error.stack);
      // Ignore stop errors
    } finally {
      console.log('[VOICE_BUTTON_DEBUG] Setting isListening to false and cleaning up state');
      setIsListening(false);
      setVolume(0);
      
      // Clear any pending speech results
      if (pendingResultsRef.current && pendingResultsRef.current.timeout) {
        clearTimeout(pendingResultsRef.current.timeout);
        console.log('[VOICE_BUTTON_DEBUG] Cleared pending results timeout');
      }
    }
  };
  // Pause voice recognition
  const pauseVoiceRecognition = async () => {
    if (!isListening) {
      return;
    }
    
    try {
      logInfo('Pausing voice recognition');
      
      // Process any pending speech before pausing
      // Check if we have any accumulated text that hasn't been processed
      if (speechTextRef.current && speechTextRef.current.length > 3 && !pendingResultsRef.current.silenceProcessed) {
        logInfo(`Processing speech before pausing: "${speechTextRef.current}"`);
        processSpeechResult(speechTextRef.current);
      }
      // Or if we have any pending results that haven't been processed
      else if (pendingResultsRef.current.pendingResults && 
               pendingResultsRef.current.pendingResults.length > 0 &&
               !pendingResultsRef.current.silenceProcessed) {
        processSpeechResult(pendingResultsRef.current.pendingResults[pendingResultsRef.current.pendingResults.length - 1].text);
      }
      
      await VoiceService.stop();
      setIsPaused(true);
      setIsListening(false);
      setVolume(0);
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
      
      // Reset all speech recognition state variables
      speechTextRef.current = '';
      pendingResultsRef.current.silenceProcessed = false;
      pendingResultsRef.current.pendingResults = [];
      pendingResultsRef.current.processingFinal = false;
      pendingResultsRef.current.lastPartial = '';
      
      // Reset result tracking variables
      lastResultTextRef.current = '';
      lastResultTimeRef.current = 0;
      
      // Start listening
      await VoiceService.start('en-US');
      setIsListening(true);
      setIsPaused(false);
      
      // Call onToggleActive AFTER state is updated to ensure proper sequence
      onToggleActive();
    } catch (error) {
      handleSpeechError({
        error: 'resume_error',
        message: error.message
      });
    }
  };
  // Add a dedicated function to process speech results immediately
  const processSpeechResult = (text) => {
    console.log('[VOICE_BUTTON_DEBUG] processSpeechResult called with text:', text?.substring(0, 30) + (text?.length > 30 ? '...' : ''));
    
    // Mark as processed to avoid duplicate processing
    pendingResultsRef.current.silenceProcessed = true;
    
    // Process the result immediately
    if (onSpeechResult && text && text.length > 3) {
      logInfo(`Processing speech result immediately: "${text}"`);
      console.log('[VOICE_BUTTON_DEBUG] Calling onSpeechResult with finalized=true');
      onSpeechResult(text, true, volume);
      
      // Reset speech state after processing
      resetSpeechState();
    } else {
      console.log('[VOICE_BUTTON_DEBUG] Text too short or onSpeechResult not defined');
      pendingResultsRef.current.silenceProcessed = false;
    }
  };
  
  // Reset speech state
  const resetSpeechState = () => {
    console.log('[VOICE_BUTTON_DEBUG] resetSpeechState called - clearing all speech recognition state');
    // Reset all the speech-related state to handle new input
    speechTextRef.current = '';
    pendingResultsRef.current.silenceProcessed = false;
    pendingResultsRef.current.lastPartial = '';
    lastResultTextRef.current = '';
    
    // Clear any pending results
    const pendingResultsCount = pendingResultsRef.current.pendingResults?.length || 0;
    pendingResultsRef.current.pendingResults = [];
    console.log('[VOICE_BUTTON_DEBUG] Cleared', pendingResultsCount, 'pending results');
    
    // Also reset the recent results array used for deduplication
    const recentResultsCount = pendingResultsRef.current.recent?.length || 0;
    pendingResultsRef.current.recent = [];
    console.log('[VOICE_BUTTON_DEBUG] Cleared', recentResultsCount, 'recent results used for deduplication');
    
    logInfo('Reset speech recognition state for new input');
  };
  
  // Get background color based on state
  const getBackgroundColor = () => {
    if (inCooldown) {
      return styles.cooldown.backgroundColor;
    }
    
    if (isAnalyzing) {
      return styles.disabled.backgroundColor;
    }
    
    if (isPaused) {
      return styles.paused.backgroundColor;
    }
    
    if (isListening) {
      // When listening, use a consistent blue color
      return styles.listening.backgroundColor;
    }
    
    if (isActive) {
      return styles.active.backgroundColor;
    }
      // When inactive, use the same color as the inactive ImmediateAnalysisButton
    return '#f0f0f0';
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
    console.log('[VOICE_BUTTON_DEBUG] Speech start event received');
    setIsListening(true);
    
    // Force reset the speech state when new speech starts
    if (pendingResultsRef.current.silenceProcessed) {
      logInfo('Forcing reset of silenceProcessed flag on new speech');
      console.log('[VOICE_BUTTON_DEBUG] Resetting silenceProcessed flag');
      pendingResultsRef.current.silenceProcessed = false;
    }
    
    // Clear the speech text when new speech starts to prevent showing old text
    if (speechTextRef.current && speechTextRef.current.length > 0) {
      logInfo('Clearing previous speech text as new speech begins');
      console.log('[VOICE_BUTTON_DEBUG] Clearing previous speech text:', speechTextRef.current);
      speechTextRef.current = '';
    }
    
    // Also clear any pending results
    if (pendingResultsRef.current.pendingResults && pendingResultsRef.current.pendingResults.length > 0) {
      console.log('[VOICE_BUTTON_DEBUG] Clearing pending results:', pendingResultsRef.current.pendingResults.length);
      pendingResultsRef.current.pendingResults = [];
    }
    
    // Reset tracking variables to ensure new speech is processed correctly
    lastResultTextRef.current = '';
    pendingResultsRef.current.lastPartial = '';
  };
  
  const handleSpeechEnd = (e) => {
    logEvent('onSpeechEnd');
    console.log('[VOICE_BUTTON_DEBUG] Speech end event received');
    
    // Don't immediately stop listening - this allows for pauses between phrases
    // Speech end might just be a pause between sentences
    setVolume(0);
    
    // Process any accumulated text when speech ends
    if (speechTextRef.current && speechTextRef.current.length > 3 && !pendingResultsRef.current.silenceProcessed) {
      console.log('[VOICE_BUTTON_DEBUG] Processing accumulated text on speech end');
      processSpeechResult(speechTextRef.current);
    }
  };  
  
  const handleSpeechResults = (results) => {
    // Ensure results exist and have values
    if (!results || !results.value || results.value.length === 0) {
      logWarn('Received empty speech results');
      return;
    }
    
    // Get recognized text
    const recognizedText = results.value[0] || '';
    
    // Update ref
    speechTextRef.current = recognizedText;
    
    // For final results, process them immediately
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
        if (__DEV__) console.log(`Ignoring duplicate speech result: "${recognizedText}" received ${timeSinceLast}ms after previous`);
        return;
      }
      
      // Update tracking variables
      lastResultTimeRef.current = currentTime;
      lastResultTextRef.current = recognizedText;
      
      // Process the final result immediately
      processSpeechResult(recognizedText);
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
    // Reduce window from 5000ms to 3000ms to be less aggressive with deduplication
    const dedupeTimeWindow = 3000; // 3 seconds instead of 5
    const recentResults = pendingResultsRef.current.recent.filter(
      item => currentTime - item.time < dedupeTimeWindow
    );
    
    // Update the recent results in the ref
    pendingResultsRef.current.recent = recentResults;
    
    // No previous results to compare against
    if (recentResults.length === 0) {
      // Add this text to recent results
      pendingResultsRef.current.recent.push({
        text: text,
        time: currentTime
      });
      return false;
    }
    
    // Basic exact match check - definitely a duplicate
    if (recentResults.some(item => item.text === text)) {
      logInfo(`Exact match found for "${text}"`);
      return true;
    }
    
    // Check for substring or very similar phrases - make this less strict
    for (const item of recentResults) {
      // Only consider substantial strings for similarity checking
      if (text.length < 4 || item.text.length < 4) continue;
      
      // If one is a substring of the other with significant overlap
      // Make more strict - require longer overlaps (15 chars instead of 10)
      if ((text.includes(item.text) && item.text.length > 15) || 
          (item.text.includes(text) && text.length > 15)) {
        logInfo(`Substring similarity detected between "${text}" and "${item.text}"`);
        return true;
      }
      
      // Simple edit distance check for similar phrases
      // This helps catch things like "What's next" vs "What's next?"
      const distance = levenshteinDistance(text.toLowerCase(), item.text.toLowerCase());
      const maxLength = Math.max(text.length, item.text.length);
      
      // If the strings are at least 95% similar (more strict - was 90%)
      if (distance / maxLength < 0.05) {
        logInfo(`Levenshtein similarity detected (${Math.round((1-(distance/maxLength))*100)}%) between "${text}" and "${item.text}"`);
        return true;
      }
    }
    
    // Add this text to recent results for future comparisons
    pendingResultsRef.current.recent.push({
      text: text,
      time: currentTime
    });
    
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
      if (pendingResultsRef.current && pendingResultsRef.current.timeout) {
        clearTimeout(pendingResultsRef.current.timeout);
      }
    };
  }, []);
    // Effect to prevent interruption during analysis
  useEffect(() => {
    // No special handling needed as silence detection is removed
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
  } else if (isPaused) {
    statusColor = '#5bc0de'; // Info for paused
    micIconName = 'play-outline'; // Show play icon when paused
  } else if (isActive) {
    statusColor = '#5bc0de'; // Info for enabled but not listening
    micIconName = 'mic-outline';
  }
  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={[
          styles.button,
          inCooldown && styles.cooldown,
          isActive && !isListening && !isPaused && styles.active,
          isListening && styles.listening,
          isPaused && styles.paused,
          !isActive && styles.inactive
        ]}
        onPress={toggleVoiceRecognition}
        onLongPress={handleLongPress}
        delayLongPress={1000}
        activeOpacity={0.7}
      >
        {isTesting ? (
          <ActivityIndicator color={isActive ? "#ffffff" : "#999"} size="small" />
        ) : (
          <Ionicons name={micIconName} size={24} color={isActive ? "white" : "#999"} />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0px 2px 2px rgba(0, 0, 0, 0.3)',
      }
    }),
  },
  inactive: {
    backgroundColor: '#f0f0f0',
  },
  active: {
    backgroundColor: 'rgba(52, 152, 219, 0.9)',
  },
  listening: {
    backgroundColor: 'rgba(52, 152, 219, 0.9)',
  },
  paused: {
    backgroundColor: 'rgba(155, 89, 182, 0.9)',
  },
  disabled: {
    backgroundColor: 'rgba(149, 165, 166, 0.8)',
  },
  cooldown: {
    backgroundColor: 'rgba(231, 76, 60, 0.8)',
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
