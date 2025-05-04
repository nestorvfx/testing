import { NativeModules, Platform, DeviceEventEmitter } from 'react-native';

const { AndroidSpeechRecognition } = NativeModules;

// Event names
const EVENT_NAMES = {
  START: 'onSpeechStart',
  END: 'onSpeechEnd',
  RESULTS: 'onSpeechResults',
  ERROR: 'onSpeechError',
  PARTIAL_RESULTS: 'onSpeechPartialResults'
};

// Create an event emitter instance
let eventEmitter;

// Check if we're on Android and the module is available
const isAndroid = Platform.OS === 'android';
const isAvailable = isAndroid && AndroidSpeechRecognition != null;

if (isAvailable) {
  // Use DeviceEventEmitter for native events
  eventEmitter = DeviceEventEmitter;
} else {
  // Dummy event emitter for non-Android platforms
  eventEmitter = {
    addListener: () => ({ remove: () => {} }),
    removeAllListeners: () => {}
  };
}

/**
 * Android Speech Recognition API
 */
const AndroidSpeech = {
  /**
   * Whether the device is running Android
   */
  isAndroid,

  /**
   * Whether speech recognition is available
   */
  isAvailable,
  
  /**
   * Check if speech recognition is supported by the device
   * @returns {Promise<boolean>}
   */
  async checkAvailability() {
    if (!isAvailable) return false;
    
    try {
      return await AndroidSpeechRecognition.isSpeechAvailable();
    } catch (error) {
      console.error('[AndroidSpeech] Error checking availability:', error);
      return false;
    }
  },
  
  /**
   * Start speech recognition
   * @param {Object} options - Recognition options
   * @param {string} [options.language='en-US'] - Language for recognition
   * @returns {Promise<void>}
   */
  start(options = {}) {
    if (!isAvailable) {
      return Promise.reject(new Error('Speech recognition is not available'));
    }
    
    return AndroidSpeechRecognition.startRecognizing(options.language || 'en-US');
  },
  
  /**
   * Stop speech recognition
   * @returns {Promise<void>}
   */
  stop() {
    if (!isAvailable) {
      return Promise.reject(new Error('Speech recognition is not available'));
    }
    
    return AndroidSpeechRecognition.stopRecognizing();
  },
  
  /**
   * Check if currently recognizing
   * @returns {Promise<boolean>}
   */
  isRecognizing() {
    if (!isAvailable) {
      return Promise.resolve(false);
    }
    
    return AndroidSpeechRecognition.isRecognizing();
  },
  
  /**
   * Add event listener
   * @param {string} eventName - Event to listen for
   * @param {Function} callback - Callback function
   * @returns {Object} - Subscription with remove() method
   */
  addListener(eventName, callback) {
    if (!isAvailable) {
      console.warn(`[AndroidSpeech] Speech recognition not available, cannot add listener for ${eventName}`);
      return { remove: () => {} };
    }
    
    return eventEmitter.addListener(eventName, callback);
  },
  
  /**
   * Remove all listeners for an event
   * @param {string} eventName - Event to remove listeners for
   */
  removeAllListeners(eventName) {
    if (isAvailable && eventEmitter.removeAllListeners) {
      eventEmitter.removeAllListeners(eventName);
    }
  },

  /**
   * Event name constants
   */
  events: EVENT_NAMES
};

export default AndroidSpeech;
