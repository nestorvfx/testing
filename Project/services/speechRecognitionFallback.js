/**
 * Speech Recognition Fallback Mechanisms
 * This file contains fallback implementations when the main Azure Speech service is unavailable
 */
import { Platform } from 'react-native';

// Web Speech API Fallback (for web platform)
export const setupWebSpeechFallback = () => {
  // Only applicable on web platform
  if (Platform.OS !== 'web') {
    return null;
  }

  try {
    // Get the appropriate SpeechRecognition constructor
    const SpeechRecognitionAPI = window.SpeechRecognition || 
                              window.webkitSpeechRecognition || 
                              window.mozSpeechRecognition || 
                              window.msSpeechRecognition;
    
    if (SpeechRecognitionAPI) {
      // Create an instance of the recognition API
      const recognition = new SpeechRecognitionAPI();
      
      // Configure the recognition
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      return recognition;
    }
  } catch (error) {
    console.error('Error initializing Web Speech API:', error);
  }
  
  return null;
};

// Continuous Recognition Fallback using the custom Android module
export const setupAndroidContinuousFallback = async (azureConfig) => {
  if (Platform.OS !== 'android') {
    return null;
  }
  
  // Import the AzureContinuousSpeech module dynamically
  try {
    // Use dynamic import to load the module
    const AzureContinuousSpeechModule = await import('react-native-azure-continuous-speech');
    const AzureContinuousSpeech = AzureContinuousSpeechModule.default;
    
    // Check if the module is available
    const isAvailable = await AzureContinuousSpeech.isAvailable();
    
    if (!isAvailable) {
      console.warn('Android continuous speech module not available on this device');
      return null;
    }
    
    console.info('Setting up Android continuous speech module');
    
    // Initialize it with the Azure credentials
    if (!AzureContinuousSpeech.isInitialized) {
      await AzureContinuousSpeech.initialize(
        azureConfig.speech.subscriptionKey,
        azureConfig.speech.region,
        { language: azureConfig.speechRecognitionLanguage || 'en-US' }
      );
    }
    
    // Create a wrapper with helper methods
    const androidModule = {
      ...AzureContinuousSpeech,
      
      // Helper to configure listeners in one call
      configureListeners: async (listeners) => {
        await configureSpeechRecognition(listeners);
        return true;
      },
      
      // Start recognition
      start: async () => {
        try {
          return await AzureContinuousSpeech.start();
        } catch (error) {
          console.error('Error starting Android speech recognition:', error);
          throw error;
        }
      },
      
      // Stop recognition
      stop: async () => {
        try {
          return await AzureContinuousSpeech.stop();
        } catch (error) {
          console.error('Error stopping Android speech recognition:', error);
          throw error;
        }
      }
    };
    
    return androidModule;
  } catch (error) {
    console.error('Error initializing Android continuous speech module:', error);
    return null;
  }
};

/**
 * Configure the speech recognizer with the provided options
 * @param {Object} options - Configuration options
 * @returns {Promise<boolean>} - Whether configuration was successful
 */
export const configureSpeechRecognition = async (options = {}) => {
  try {
    // Use dynamic import to load the module
    const AzureContinuousSpeechModule = await import('react-native-azure-continuous-speech');
    const { configureSpeechRecognition: configure } = AzureContinuousSpeechModule;
    
    if (typeof configure === 'function') {
      return await configure(options);
    }
    
    console.warn('configureSpeechRecognition not available in module');
    return false;
  } catch (error) {
    console.error('Error configuring speech recognition:', error);
    return false;
  }
};

export default {
  setupWebSpeechFallback,
  setupAndroidContinuousFallback,
  configureSpeechRecognition
};
