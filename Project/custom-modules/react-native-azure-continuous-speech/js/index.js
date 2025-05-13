/**
 * Azure Continuous Speech Recognition Module for React Native
 * 
 * This module provides a JavaScript interface to the native Android implementation
 * of continuous speech recognition using Azure Speech SDK.
 */
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { AzureContinuousSpeech } = NativeModules;

// Return a mock implementation if the module is not available (iOS or web)
if (!AzureContinuousSpeech) {
  console.warn('AzureContinuousSpeech module is not available on this platform');
}

// Create event emitter for the native module
const azureSpeechEmitter = AzureContinuousSpeech 
  ? new NativeEventEmitter(AzureContinuousSpeech)
  : null;

/**
 * Class for Azure Continuous Speech recognition
 */
class AzureContinuousSpeechRecognizer {
  constructor() {
    this.isInitialized = false;
    this.isListening = false;
    this.listeners = [];
    
    // Callbacks
    this.onSpeechStart = null;
    this.onSpeechEnd = null;
    this.onSpeechResults = null;
    this.onSpeechPartialResults = null;
    this.onSpeechError = null;
  }
  
  /**
   * Check if the module is available on this platform
   * @returns {Promise<boolean>} True if available, false otherwise
   */
  async isAvailable() {
    // If on Android, check if the native module is available
    if (Platform.OS === 'android' && AzureContinuousSpeech) {
      return AzureContinuousSpeech.isAvailable();
    }
    
    // Not available on other platforms
    return false;
  }
  
  /**
   * Initialize the speech recognizer
   * @param {string} subscriptionKey - Azure Speech subscription key
   * @param {string} region - Azure Speech region
   * @param {Object} options - Additional options
   * @returns {Promise<string>} Success message or error
   */
  async initialize(subscriptionKey, region, options = {}) {
    if (Platform.OS !== 'android' || !AzureContinuousSpeech) {
      throw new Error('AzureContinuousSpeech module is only available on Android');
    }
    
    // Initialize the native module
    await AzureContinuousSpeech.initialize(subscriptionKey, region, options);
    this.isInitialized = true;
    
    // Setup event listeners
    this._setupEventListeners();
    
    return "Initialized Azure Continuous Speech successfully";
  }
  
  /**
   * Set up event listeners for the native module
   * @private
   */
  _setupEventListeners() {
    // Remove any existing listeners
    this._removeEventListeners();
    
    // Add new listeners
    if (azureSpeechEmitter) {
      // Listen for speech recognition events
      this.listeners.push(
        azureSpeechEmitter.addListener('SpeechRecognizing', event => {
          if (this.onSpeechPartialResults) {
            this.onSpeechPartialResults({ value: [event.text], isFinal: false });
          }
        })
      );
      
      this.listeners.push(
        azureSpeechEmitter.addListener('SpeechRecognized', event => {
          if (this.onSpeechResults && event.isFinal) {
            this.onSpeechResults({ value: [event.text], isFinal: true });
          }
        })
      );
      
      // Session events
      this.listeners.push(
        azureSpeechEmitter.addListener('SpeechSessionStarted', event => {
          if (this.onSpeechStart) {
            this.onSpeechStart(event);
          }
        })
      );
      
      this.listeners.push(
        azureSpeechEmitter.addListener('SpeechSessionStopped', event => {
          this.isListening = false;
          if (this.onSpeechEnd) {
            this.onSpeechEnd(event);
          }
        })
      );
      
      // Error and cancellation events
      this.listeners.push(
        azureSpeechEmitter.addListener('SpeechCanceled', event => {
          this.isListening = false;
          if (this.onSpeechError) {
            this.onSpeechError(event);
          }
        })
      );
      
      this.listeners.push(
        azureSpeechEmitter.addListener('SpeechRecognitionError', event => {
          this.isListening = false;
          if (this.onSpeechError) {
            this.onSpeechError(event);
          }
        })
      );
      
      // Start/stop events
      this.listeners.push(
        azureSpeechEmitter.addListener('SpeechRecognitionStarted', event => {
          this.isListening = true;
          if (this.onSpeechStart) {
            this.onSpeechStart(event);
          }
        })
      );
      
      this.listeners.push(
        azureSpeechEmitter.addListener('SpeechRecognitionStopped', event => {
          this.isListening = false;
          if (this.onSpeechEnd) {
            this.onSpeechEnd(event);
          }
        })
      );
    }
  }
  
  /**
   * Remove all event listeners
   * @private
   */
  _removeEventListeners() {
    if (this.listeners && this.listeners.length > 0) {
      this.listeners.forEach(listener => {
        if (listener && typeof listener.remove === 'function') {
          listener.remove();
        }
      });
      this.listeners = [];
    }
  }
  
  /**
   * Start continuous speech recognition
   * @returns {Promise<string>} Success message or error
   */
  async start() {
    if (Platform.OS !== 'android' || !AzureContinuousSpeech) {
      throw new Error('AzureContinuousSpeech module is only available on Android');
    }
    
    if (!this.isInitialized) {
      throw new Error('Azure Continuous Speech not initialized');
    }
    
    if (this.isListening) {
      return "Already listening";
    }
    
    const result = await AzureContinuousSpeech.startContinuousRecognition();
    this.isListening = true;
    return result;
  }
  
  /**
   * Stop continuous speech recognition
   * @returns {Promise<string>} Success message or error
   */
  async stop() {
    if (Platform.OS !== 'android' || !AzureContinuousSpeech) {
      throw new Error('AzureContinuousSpeech module is only available on Android');
    }
    
    if (!this.isInitialized) {
      throw new Error('Azure Continuous Speech not initialized');
    }
    
    if (!this.isListening) {
      return "Not listening";
    }
    
    const result = await AzureContinuousSpeech.stopContinuousRecognition();
    this.isListening = false;
    return result;
  }
  
  /**
   * Destroy the speech recognizer and free resources
   * @returns {Promise<string>} Success message or error
   */
  async destroy() {
    if (Platform.OS !== 'android' || !AzureContinuousSpeech) {
      return "Not available on this platform";
    }
    
    // Remove event listeners
    this._removeEventListeners();
    
    if (!this.isInitialized) {
      return "Not initialized";
    }
    
    // Stop recognition if it's running
    if (this.isListening) {
      await this.stop();
    }
    
    // Destroy the recognizer
    const result = await AzureContinuousSpeech.destroyRecognizer();
    this.isInitialized = false;
    this.isListening = false;
    
    return result;
  }
}

// Export a singleton instance
const azureContinuousSpeech = new AzureContinuousSpeechRecognizer();

/**
 * Configure the speech recognizer with the provided options
 * @param {Object} options - Configuration options
 * @returns {Promise<boolean>} - Whether configuration was successful
 */
export const configureSpeechRecognition = async (options = {}) => {
  if (!azureContinuousSpeech) return false;
  
  // Set up event handlers if provided
  if (options.onSpeechStart) {
    azureContinuousSpeech.onSpeechStart = options.onSpeechStart;
  }
  
  if (options.onSpeechEnd) {
    azureContinuousSpeech.onSpeechEnd = options.onSpeechEnd;
  }
  
  if (options.onSpeechResults) {
    azureContinuousSpeech.onSpeechResults = options.onSpeechResults;
  }
  
  if (options.onSpeechPartialResults) {
    azureContinuousSpeech.onSpeechPartialResults = options.onSpeechPartialResults;
  }
  
  if (options.onSpeechError) {
    azureContinuousSpeech.onSpeechError = options.onSpeechError;
  }
  
  return true;
};

// Export default and named exports for flexibility
export { azureContinuousSpeech };
export default azureContinuousSpeech;
