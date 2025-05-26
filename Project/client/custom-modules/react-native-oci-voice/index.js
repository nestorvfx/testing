/**
 * React Native OCI Voice Module
 * This module provides a native interface to OCI Speech service for Android
 */
import { NativeModules, Platform, NativeEventEmitter } from 'react-native';

const LINKING_ERROR =
  `The package 'react-native-oci-voice' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

// Get the native module
const OCIVoiceModule = NativeModules.OCIVoice
  ? NativeModules.OCIVoice
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

// Create an event emitter for the native module
const eventEmitter = OCIVoiceModule ? new NativeEventEmitter(OCIVoiceModule) : null;

class OCIVoiceNative {
  constructor() {
    this.isInitialized = false;
    this.isListening = false;
    this.listeners = {};
    
    // Set up event handlers if the module is available
    if (eventEmitter) {
      this._subscribeToEvents();
    }
  }
  
  /**
   * Subscribe to native module events
   * @private
   */
  _subscribeToEvents() {
    // Map of event names
    const events = [
      'onSpeechStart',
      'onSpeechEnd',
      'onSpeechResults',
      'onSpeechPartialResults',
      'onSpeechError',
      'onSpeechVolumeChanged'
    ];
    
    // Subscribe to each event
    events.forEach(eventName => {
      this.listeners[eventName] = eventEmitter.addListener(
        eventName,
        (data) => {
          // Call the appropriate callback if it exists
          if (this[eventName]) {
            this[eventName](data);
          }
        }
      );
    });
  }
  
  /**
   * Initialize the OCI Voice module
   * @param {Object} config Configuration options
   * @returns {Promise<boolean>} Whether initialization was successful
   */
  async initialize(config = {}) {
    if (!OCIVoiceModule) {
      return false;
    }
    
    try {
      const result = await OCIVoiceModule.initialize(config);
      this.isInitialized = result;
      return result;
    } catch (error) {
      console.error('Failed to initialize OCI Voice module:', error);
      return false;
    }
  }
  
  /**
   * Start listening for speech
   * @param {Object} options Options for speech recognition
   * @returns {Promise<boolean>} Whether start was successful
   */
  async startListening(options = {}) {
    if (!OCIVoiceModule || !this.isInitialized) {
      return false;
    }
    
    try {
      const result = await OCIVoiceModule.startListening(options);
      this.isListening = result;
      return result;
    } catch (error) {
      console.error('Failed to start listening:', error);
      return false;
    }
  }
  
  /**
   * Stop listening for speech
   * @returns {Promise<boolean>} Whether stop was successful
   */
  async stopListening() {
    if (!OCIVoiceModule || !this.isListening) {
      return false;
    }
    
    try {
      const result = await OCIVoiceModule.stopListening();
      this.isListening = !result;
      return result;
    } catch (error) {
      console.error('Failed to stop listening:', error);
      return false;
    }
  }
  
  /**
   * Set the callback for speech start events
   * @param {Function} callback The callback function
   */
  setOnSpeechStart(callback) {
    this.onSpeechStart = callback;
  }
  
  /**
   * Set the callback for speech end events
   * @param {Function} callback The callback function
   */
  setOnSpeechEnd(callback) {
    this.onSpeechEnd = callback;
  }
  
  /**
   * Set the callback for speech results events
   * @param {Function} callback The callback function
   */
  setOnSpeechResults(callback) {
    this.onSpeechResults = callback;
  }
  
  /**
   * Set the callback for speech partial results events
   * @param {Function} callback The callback function
   */
  setOnSpeechPartialResults(callback) {
    this.onSpeechPartialResults = callback;
  }
  
  /**
   * Set the callback for speech error events
   * @param {Function} callback The callback function
   */
  setOnSpeechError(callback) {
    this.onSpeechError = callback;
  }
  
  /**
   * Set the callback for speech volume changed events
   * @param {Function} callback The callback function
   */
  setOnSpeechVolumeChanged(callback) {
    this.onSpeechVolumeChanged = callback;
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    if (eventEmitter) {
      // Remove all event listeners
      Object.values(this.listeners).forEach(listener => {
        listener.remove();
      });
      
      this.listeners = {};
    }
    
    if (OCIVoiceModule) {
      OCIVoiceModule.destroy();
    }
    
    this.isInitialized = false;
    this.isListening = false;
  }
}

// Export a singleton instance
export default new OCIVoiceNative();
