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
   * Initialize the speech recognizer with Azure credentials
   * @param {string} subscriptionKey - Azure Speech subscription key
   * @param {string} region - Azure Speech service region
   * @param {Object} options - Additional options
   * @param {string} options.language - Recognition language (default: 'en-US')
   * @returns {Promise<boolean>} True if initialization successful
   */
  async initialize(subscriptionKey, region, options = {}) {
    if (!AzureContinuousSpeech) {
      console.error('AzureContinuousSpeech module not available');
      return false;
    }
    
    try {
      await AzureContinuousSpeech.initialize(subscriptionKey, region, options);
      this.isInitialized = true;
      
      // Setup event listeners
      this._setupEventListeners();
      
      return true;
    } catch (error) {
      console.error('Error initializing Azure Speech:', error);
      return false;
    }
  }
  
  /**
   * Start continuous speech recognition
   * @returns {Promise<boolean>} True if started successfully
   */
  async start() {
    if (!this.isInitialized || !AzureContinuousSpeech) {
      console.error('AzureContinuousSpeech not initialized');
      return false;
    }
    
    if (this.isListening) {
      console.warn('Already listening');
      return true;
    }
    
    try {
      await AzureContinuousSpeech.start();
      this.isListening = true;
      return true;
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      return false;
    }
  }
  
  /**
   * Stop continuous speech recognition
   * @returns {Promise<boolean>} True if stopped successfully
   */
  async stop() {
    if (!this.isInitialized || !AzureContinuousSpeech) {
      console.error('AzureContinuousSpeech not initialized');
      return false;
    }
    
    if (!this.isListening) {
      console.warn('Not listening');
      return true;
    }
    
    try {
      await AzureContinuousSpeech.stop();
      this.isListening = false;
      return true;
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
      return false;
    }
  }
  
  /**
   * Destroy the speech recognizer and release resources
   * @returns {Promise<boolean>} True if destroyed successfully
   */
  async destroy() {
    if (!this.isInitialized || !AzureContinuousSpeech) {
      return true;
    }
    
    try {
      // Remove all listeners
      this._removeAllListeners();
      
      await AzureContinuousSpeech.destroy();
      this.isInitialized = false;
      this.isListening = false;
      return true;
    } catch (error) {
      console.error('Error destroying speech recognizer:', error);
      return false;
    }
  }
  
  /**
   * Set up callback functions for speech events
   * @param {Object} callbacks - Callback functions
   */
  async setCallbacks(callbacks) {
    if (callbacks.onSpeechStart) this.onSpeechStart = callbacks.onSpeechStart;
    if (callbacks.onSpeechEnd) this.onSpeechEnd = callbacks.onSpeechEnd;
    if (callbacks.onSpeechResults) this.onSpeechResults = callbacks.onSpeechResults;
    if (callbacks.onSpeechPartialResults) this.onSpeechPartialResults = callbacks.onSpeechPartialResults;
    if (callbacks.onSpeechError) this.onSpeechError = callbacks.onSpeechError;
  }
  
  /**
   * Setup event listeners for native module events
   * @private
   */
  _setupEventListeners() {
    if (!azureSpeechEmitter) return;
    
    // Remove any existing listeners
    this._removeAllListeners();
    
    // Add listeners for each event type
    this.listeners.push(
      azureSpeechEmitter.addListener('onSpeechStart', (event) => {
        if (this.onSpeechStart) this.onSpeechStart(event);
      })
    );
    
    this.listeners.push(
      azureSpeechEmitter.addListener('onSpeechEnd', (event) => {
        this.isListening = false;
        if (this.onSpeechEnd) this.onSpeechEnd(event);
      })
    );
      this.listeners.push(
      azureSpeechEmitter.addListener('onSpeechResults', (event) => {
        // Format the results to match the expected structure
        const formattedResults = {
          value: [event.value || ''],
          isFinal: event.isFinal || true
        };
        if (this.onSpeechResults) this.onSpeechResults(formattedResults);
      })
    );
    
    this.listeners.push(
      azureSpeechEmitter.addListener('onSpeechPartialResults', (event) => {
        // Format the partial results to match the expected structure
        const formattedResults = {
          value: [event.value || ''],
          isFinal: false
        };
        if (this.onSpeechPartialResults) this.onSpeechPartialResults(formattedResults);
      })
    );
    
    this.listeners.push(
      azureSpeechEmitter.addListener('onSpeechError', (event) => {
        this.isListening = false;
        if (this.onSpeechError) this.onSpeechError(event);
      })
    );
  }
  
  /**
   * Remove all event listeners
   * @private
   */
  _removeAllListeners() {
    if (this.listeners.length > 0) {
      this.listeners.forEach(listener => {
        if (listener) {
          listener.remove();
        }
      });
      this.listeners = [];
    }
  }
}

// Create singleton instance
const AzureContinuousSpeechInstance = new AzureContinuousSpeechRecognizer();

// Export the singleton
export default AzureContinuousSpeechInstance;
