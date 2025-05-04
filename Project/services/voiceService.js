import { Platform, NativeEventEmitter, NativeModules, PermissionsAndroid } from 'react-native';

// Debug logging helper
const LOG_PREFIX = '[VoiceService]';
const log = {
  info: (message, data) => {
    console.log(`${LOG_PREFIX} INFO: ${message}`, data !== undefined ? data : '');
  },
  warn: (message, data) => {
    console.warn(`${LOG_PREFIX} WARN: ${message}`, data !== undefined ? data : '');
  },
  error: (message, data) => {
    console.error(`${LOG_PREFIX} ERROR: ${message}`, data !== undefined ? data : '');
  },
  debug: (message, data) => {
    console.log(`${LOG_PREFIX} DEBUG: ${message}`, data !== undefined ? data : '');
  }
};

// Import AndroidSpeech only on Android platform
let AndroidSpeech = null;
if (Platform.OS === 'android') {
  try {
    log.info('Attempting to import react-native-android-speech');
    // Fix #1: Handle default export properly
    const speechModule = require('react-native-android-speech');
    AndroidSpeech = speechModule.default || speechModule;
    log.info('Import successful', AndroidSpeech ? 'Module loaded' : 'Module is null');
    
    // Log available methods and properties
    log.debug('AndroidSpeech properties:', Object.keys(AndroidSpeech));
    
    // Fix #2: Initialize directly from NativeModules if needed
    if (!AndroidSpeech.events) {
      log.info('Attempting to access module from NativeModules');
      const nativeModule = NativeModules.AndroidSpeechRecognition;
      if (nativeModule) {
        log.info('Found native module, creating JS wrapper');
        // Create a proper wrapper if needed
        AndroidSpeech = {
          ...nativeModule,
          events: {
            START: 'onSpeechStart',
            END: 'onSpeechEnd',
            RESULTS: 'onSpeechResults',
            PARTIAL_RESULTS: 'onSpeechPartialResults',
            ERROR: 'onSpeechError'
          },
          // Create event emitter for the native module
          addListener: (eventName, callback) => {
            const eventEmitter = new NativeEventEmitter(nativeModule);
            return eventEmitter.addListener(eventName, callback);
          }
        };
        log.info('Created JS wrapper for native module');
      } else {
        log.error('Native module not found in NativeModules');
      }
    }
    
    log.debug('AndroidSpeech.events:', AndroidSpeech.events);
  } catch (e) {
    log.error('Error importing react-native-android-speech:', e);
  }
}

class VoiceService {
  constructor() {
    log.info('Initializing VoiceService');
    this.listeners = [];
    this.isInitialized = false;
    this.isListening = false;
    
    // Add cooldown tracking
    this.lastErrorTime = 0;
    this.errorCount = 0;
    this.restartAttempts = 0;
    this.maxRestartAttempts = 5;
    this.restartCooldown = 1500; // 1.5 seconds between restarts
    this.errorCooldown = 5000; // 5 seconds after repeated errors
    this.isInCooldown = false;
    
    // Event handler callbacks
    this.onSpeechStart = null;
    this.onSpeechEnd = null;
    this.onSpeechResults = null;
    this.onSpeechPartialResults = null;
    this.onSpeechError = null;
    this.onSpeechVolumeChanged = null;
    
    // Compare with working example
    if (Platform.OS === 'android' && AndroidSpeech) {
      log.debug('Comparing with working example:');
      log.debug('- checkAvailability exists:', typeof AndroidSpeech.checkAvailability === 'function');
      log.debug('- start exists:', typeof AndroidSpeech.start === 'function');
      log.debug('- stop exists:', typeof AndroidSpeech.stop === 'function');
      log.debug('- isRecognizing exists:', typeof AndroidSpeech.isRecognizing === 'function');
      log.debug('- events object exists:', !!AndroidSpeech.events);
      if (AndroidSpeech.events) {
        log.debug('- START event:', AndroidSpeech.events.START);
        log.debug('- END event:', AndroidSpeech.events.END);
        log.debug('- RESULTS event:', AndroidSpeech.events.RESULTS);
      }
    }
  }
  
  // Check if voice recognition is available
  async isAvailable() {
    log.info('Checking voice recognition availability');
    
    if (Platform.OS !== 'android') {
      log.info('Not on Android platform, returning false');
      return false;
    }
    
    if (!AndroidSpeech) {
      log.error('AndroidSpeech module not loaded, returning false');
      return false;
    }
    
    try {
      // Fix #3: Alternative availability check
      if (typeof AndroidSpeech.checkAvailability === 'function') {
        const available = await AndroidSpeech.checkAvailability();
        log.info(`Native checkAvailability returned: ${available}`);
        return true;
      } else {
        // Fallback: Check if basic functionality exists
        log.info('Using fallback availability check');
        const hasStart = typeof AndroidSpeech.start === 'function';
        const hasEvents = !!AndroidSpeech.events;
        const available = hasStart && hasEvents;
        log.info(`Fallback availability check: ${available}`);
        return available;
      }
    } catch (e) {
      log.error('Error checking speech recognition availability:', e);
      return false;
    }
  }
  
  // Request microphone permission
  async requestMicrophonePermission() {
    log.info('Requesting microphone permission');
    
    if (Platform.OS !== 'android') {
      return true;
    }
    
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: "Microphone Permission",
          message: "This app needs access to your microphone for voice recognition",
          buttonNeutral: "Ask Me Later",
          buttonNegative: "Cancel",
          buttonPositive: "OK"
        }
      );
      log.info(`Microphone permission result: ${granted}`);
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      log.error('Error requesting microphone permission:', err);
      return false;
    }
  }

  // Set up event listeners
  setup() {
    log.info('Setting up speech recognition listeners');
    
    if (this.isInitialized) {
      log.info('Already initialized, skipping setup');
      return;
    }
    
    if (Platform.OS !== 'android') {
      log.info('Not on Android platform, skipping setup');
      return;
    }
    
    if (!AndroidSpeech) {
      log.error('AndroidSpeech module not loaded, skipping setup');
      return;
    }
    
    try {
      log.debug('AndroidSpeech.events:', AndroidSpeech.events);
      
      if (!AndroidSpeech.events) {
        log.error('AndroidSpeech.events is undefined, cannot set up listeners');
        return;
      }
      
      log.info('Setting up START listener');
      this.listeners.push(
        AndroidSpeech.addListener(AndroidSpeech.events.START, (e) => {
          log.info('START event received', e);
          if (this.onSpeechStart) this.onSpeechStart(e);
        })
      );
      
      log.info('Setting up END listener');
      this.listeners.push(
        AndroidSpeech.addListener(AndroidSpeech.events.END, (e) => {
          log.info('END event received', e);
          if (this.onSpeechEnd) this.onSpeechEnd(e);
        })
      );
      
      log.info('Setting up RESULTS listener');
      this.listeners.push(
        AndroidSpeech.addListener(AndroidSpeech.events.RESULTS, (e) => {
          log.info('RESULTS event received', e);
          if (this.onSpeechResults) this.onSpeechResults(e);
        })
      );
      
      log.info('Setting up PARTIAL_RESULTS listener');
      this.listeners.push(
        AndroidSpeech.addListener(AndroidSpeech.events.PARTIAL_RESULTS, (e) => {
          log.info('PARTIAL_RESULTS event received', e);
          if (this.onSpeechPartialResults) this.onSpeechPartialResults(e);
        })
      );
      
      log.info('Setting up ERROR listener');
      this.listeners.push(
        AndroidSpeech.addListener(AndroidSpeech.events.ERROR, (e) => {
          // Filter out certain errors to avoid logs
          const isSilentError = e && e.error && (
            e.error.code === 7 || // No recognition matches
            (e.error.code === 5 && this.errorCount > 2) // Repeated client side errors
          );
          
          if (!isSilentError) {
            log.error('ERROR event received', e);
          } else {
            log.debug('Silent error event received', e);
          }
          
          // Handle error with cooldown logic
          this.handleSpeechError(e);
          
          // Still call the error callback but filter some errors
          if (this.onSpeechError && !isSilentError) {
            this.onSpeechError(e);
          }
        })
      );
      
      // Add volume change listener if supported
      if (AndroidSpeech.events.VOLUME_CHANGED) {
        log.info('Setting up VOLUME_CHANGED listener');
        this.listeners.push(
          AndroidSpeech.addListener(AndroidSpeech.events.VOLUME_CHANGED, (e) => {
            log.debug('VOLUME_CHANGED event received', e);
            if (this.onSpeechVolumeChanged) this.onSpeechVolumeChanged(e);
          })
        );
      }
      
      this.isInitialized = true;
      log.info('Speech recognition listeners set up successfully');
    } catch (e) {
      log.error('Error setting up speech recognition listeners:', e);
    }
  }
  
  // Add error handling with cooldown
  handleSpeechError(e) {
    const now = Date.now();
    const errorCode = e && e.error ? e.error.code : null;
    
    // Update error tracking
    if (now - this.lastErrorTime < 10000) { // Within 10 seconds
      this.errorCount++;
    } else {
      this.errorCount = 1;
    }
    this.lastErrorTime = now;
    
    // Determine if we should restart based on error type
    let shouldRestart = true;
    let cooldownTime = this.restartCooldown;
    
    // Don't restart for certain errors or after too many attempts
    if (
      (errorCode === 7) || // No recognition matches - normal, can restart
      (errorCode === 5 && this.errorCount <= 3) // Client side error - only retry a few times
    ) {
      shouldRestart = true;
    } else if (this.errorCount > 3 || this.restartAttempts >= this.maxRestartAttempts) {
      // Too many errors or restart attempts
      log.warn(`Too many errors (${this.errorCount}) or restart attempts (${this.restartAttempts}), entering longer cooldown`);
      shouldRestart = true;
      this.restartAttempts = 0; // Reset attempts but use longer cooldown
      cooldownTime = this.errorCooldown;
    }
    
    // Set a cooldown before attempting to restart
    if (shouldRestart && !this.isInCooldown) {
      this.isInCooldown = true;
      this.isListening = false;
      
      setTimeout(() => {
        this.isInCooldown = false;
        this.restartAttempts++;
        
        // Automatically restart if needed (will be called from VoiceButton component)
        log.debug(`Cooldown complete, ready for restart`);
      }, cooldownTime);
    }
  }
  
  // Start speech recognition
  async start(language = 'en_US') {
    log.info(`Starting speech recognition with language: ${language}`);
    
    if (Platform.OS !== 'android') {
      log.error('Not on Android platform');
      return Promise.reject(new Error('Speech recognition is only available on Android'));
    }
    
    if (!AndroidSpeech) {
      log.error('AndroidSpeech module not loaded');
      return Promise.reject(new Error('Speech recognition module not loaded'));
    }
    
    // Check if in cooldown period
    if (this.isInCooldown) {
      log.info('In cooldown period, delaying start');
      return Promise.reject(new Error('In cooldown period'));
    }
    
    // Check if already listening
    if (this.isListening) {
      log.info('Already listening, skipping start');
      return Promise.resolve();
    }
    
    try {
      // Request permission first
      log.info('Requesting microphone permission');
      const hasPermission = await this.requestMicrophonePermission();
      if (!hasPermission) {
        log.error('Microphone permission denied');
        return Promise.reject(new Error('Microphone permission denied'));
      }
      
      // Check if already listening
      log.info('Checking if already recognizing');
      if (typeof AndroidSpeech.isRecognizing === 'function') {
        const recognizing = await AndroidSpeech.isRecognizing();
        log.info(`isRecognizing returned: ${recognizing}`);
        if (recognizing) {
          log.info('Already recognizing, stopping first');
          await AndroidSpeech.stop();
        }
      }
      
      // Start recognition with the specified language
      log.info('Calling AndroidSpeech.start', { language });
      await AndroidSpeech.start({ language });
      this.isListening = true;
      this.restartAttempts = 0; // Reset restart attempts on successful start
      log.info('Speech recognition started successfully');
      return Promise.resolve();
    } catch (e) {
      log.error('Error starting speech recognition:', e);
      this.isListening = false;
      
      // Only reject with error message if it's not a common error
      const isCommonError = e && e.message && (
        e.message.includes('already started') || 
        e.message.includes('busy')
      );
      
      if (isCommonError) {
        log.info('Common start error, resolving anyway');
        return Promise.resolve();
      }
      
      return Promise.reject(e);
    }
  }
  
  // Stop speech recognition
  async stop() {
    log.info('Stopping speech recognition');
    
    if (Platform.OS !== 'android' || !AndroidSpeech) {
      log.info('Not on Android or module not loaded, resolving immediately');
      return Promise.resolve();
    }
    
    try {
      // Check if recognizing
      if (typeof AndroidSpeech.isRecognizing === 'function') {
        const recognizing = await AndroidSpeech.isRecognizing();
        log.info(`isRecognizing returned: ${recognizing}`);
        
        if (recognizing) {
          log.info('Currently recognizing, calling stop');
          await AndroidSpeech.stop();
          log.info('Stop successful');
        } else {
          log.info('Not currently recognizing, nothing to stop');
        }
      } else {
        // Fallback if isRecognizing is not available
        log.info('isRecognizing not available, calling stop directly');
        await AndroidSpeech.stop();
      }
      
      this.isListening = false;
      return Promise.resolve();
    } catch (e) {
      log.error('Error stopping speech recognition:', e);
      return Promise.reject(e);
    }
  }
  
  // Cancel speech recognition
  async cancel() {
    log.info('Cancelling speech recognition');
    
    if (Platform.OS !== 'android' || !AndroidSpeech) {
      return Promise.resolve();
    }
    
    try {
      const recognizing = await AndroidSpeech.isRecognizing();
      if (recognizing) {
        await AndroidSpeech.cancel();
      }
      this.isListening = false;
      return Promise.resolve();
    } catch (e) {
      log.error('Error canceling speech recognition:', e);
      return Promise.reject(e);
    }
  }
  
  // Clean up all listeners
  destroy() {
    log.info('Destroying speech recognition service');
    
    if (Platform.OS !== 'android' || !AndroidSpeech) {
      return;
    }
    
    try {
      // Remove all event listeners
      this.listeners.forEach(listener => {
        if (listener && typeof listener.remove === 'function') {
          listener.remove();
        }
      });
      
      this.listeners = [];
      this.isInitialized = false;
    } catch (e) {
      log.error('Error destroying speech recognition service:', e);
    }
  }
}

// Export singleton instance
export default new VoiceService();
