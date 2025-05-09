/**
 * Web Speech API helper for browser environments
 * This provides a fallback when Azure Speech services aren't available
 */

// Check if Web Speech API is available
export const isWebSpeechSupported = () => {
  return typeof window !== 'undefined' && (
    window.SpeechRecognition ||
    window.webkitSpeechRecognition ||
    window.mozSpeechRecognition ||
    window.msSpeechRecognition
  );
};

// Get the appropriate SpeechRecognition constructor for the current browser
export const getSpeechRecognition = () => {
  if (!isWebSpeechSupported()) return null;
  
  return window.SpeechRecognition ||
         window.webkitSpeechRecognition ||
         window.mozSpeechRecognition ||
         window.msSpeechRecognition;
};

// Request microphone permission in the browser
export const requestMicrophonePermission = async () => {
  if (!navigator || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.error('Media devices API not supported in this browser');
    return false;
  }
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Success! Close the stream since we only needed to request permission
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (err) {
    console.error('Microphone permission denied:', err);
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
    console.error('Error creating SpeechRecognition:', error);
    return null;
  }
};
