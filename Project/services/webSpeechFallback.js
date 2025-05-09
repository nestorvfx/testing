/**
 * Web Speech API helper for browser environments
 * This provides a fallback when Azure Speech services aren't available
 */

import { Platform } from 'react-native';

// Add minimal logging for critical errors only
const log = {
  error: (message) => console.error(`[WebSpeech] ERROR: ${message}`)
};

// Check if Web Speech API is available
export const isWebSpeechSupported = () => {
  // Only check for Web Speech API on web platform
  if (Platform.OS !== 'web') {
    return false;
  }
  
  const supported = typeof window !== 'undefined' && (
    window.SpeechRecognition ||
    window.webkitSpeechRecognition ||
    window.mozSpeechRecognition ||
    window.msSpeechRecognition
  );
  
  return supported;
};

// Get the appropriate SpeechRecognition constructor for the current browser
export const getSpeechRecognition = () => {
  if (!isWebSpeechSupported()) return null;
  
  const api = window.SpeechRecognition ||
         window.webkitSpeechRecognition ||
         window.mozSpeechRecognition ||
         window.msSpeechRecognition;
  
  return api;
};

// Request microphone permission in the browser
export const requestMicrophonePermission = async () => {
  // Make sure we're on web platform before attempting to use web APIs
  if (Platform.OS !== 'web') {
    log.error('requestMicrophonePermission called on non-web platform');
    return false;
  }
    if (!navigator || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    log.error('Media devices API not supported in this browser');
    return false;
  }
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Success! Close the stream since we only needed to request permission
    stream.getTracks().forEach(track => {
      track.stop();
    });
    return true;
  } catch (err) {
    log.error(`Microphone permission denied: ${err.message || err}`);
    return false;
  }
};

// Create and configure a SpeechRecognition instance
export const createSpeechRecognition = (options = {}) => {
  const SpeechRecognitionAPI = getSpeechRecognition();
  if (!SpeechRecognitionAPI) return null;
  
  try {
    // Create a new instance with the new operator
    const recognition = new SpeechRecognitionAPI();
    
    // Configure recognition
    recognition.continuous = options.continuous !== false;
    recognition.interimResults = options.interimResults !== false;
    recognition.lang = options.language || 'en-US';
    
    return recognition;
  } catch (error) {
    log.error('Error creating SpeechRecognition: ' + error.message);
    return null;
  }
};
