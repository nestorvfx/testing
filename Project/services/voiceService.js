import { Platform, NativeEventEmitter, NativeModules, PermissionsAndroid } from 'react-native';

// Create better logger for troubleshooting
const log = {
  info: (message) => console.log(`[VoiceService] INFO: ${message}`),
  warn: (message) => console.warn(`[VoiceService] WARN: ${message}`),
  error: (message) => console.error(`[VoiceService] ERROR: ${message}`),
  debug: (message) => console.log(`[VoiceService] DEBUG: ${message}`)
};

// Import AndroidSpeech only on Android platform
let AndroidSpeech = null;
if (Platform.OS === 'android') {
  try {
    const speechModule = require('react-native-android-speech');
    AndroidSpeech = speechModule.default || speechModule;
    
    if (!AndroidSpeech.events) {
      const nativeModule = NativeModules.AndroidSpeechRecognition;
      if (nativeModule) {
        AndroidSpeech = {
          ...nativeModule,
          events: {
            START: 'onSpeechStart',
            END: 'onSpeechEnd',
            RESULTS: 'onSpeechResults',
            PARTIAL_RESULTS: 'onSpeechPartialResults',
            ERROR: 'onSpeechError'
          },
          addListener: (eventName, callback) => {
            const eventEmitter = new NativeEventEmitter(nativeModule);
            return eventEmitter.addListener(eventName, callback);
          }
        };
      }
    }
  } catch (e) {
    log.error('Error importing speech recognition module');
  }
}

class VoiceService {
  constructor() {
    this.listeners = [];
    this.isInitialized = false;
    this.isListening = false;
    
    // Adjust cooldown tracking to be more resilient
    this.lastErrorTime = 0;
    this.errorCount = 0;
    this.restartAttempts = 0;
    this.maxRestartAttempts = 5;
    this.restartCooldown = 1500;
    this.errorCooldown = 5000;
    this.isInCooldown = false;
    
    // Add cooldown timeout to better manage states
    this.cooldownTimer = null;
    
    // Event handler callbacks
    this.onSpeechStart = null;
    this.onSpeechEnd = null;
    this.onSpeechResults = null;
    this.onSpeechPartialResults = null;
    this.onSpeechError = null;
    this.onSpeechVolumeChanged = null;
  }
  
  async isAvailable() {
    if (Platform.OS !== 'android') {
      return false;
    }
    
    if (!AndroidSpeech) {
      return false;
    }
    
    try {
      if (typeof AndroidSpeech.checkAvailability === 'function') {
        const available = await AndroidSpeech.checkAvailability();
        return true;
      } else {
        const hasStart = typeof AndroidSpeech.start === 'function';
        const hasEvents = !!AndroidSpeech.events;
        return hasStart && hasEvents;
      }
    } catch (e) {
      return false;
    }
  }
  
  async requestMicrophonePermission() {
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
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      return false;
    }
  }

  setup() {
    if (this.isInitialized) {
      return;
    }
    
    if (Platform.OS !== 'android') {
      return;
    }
    
    if (!AndroidSpeech) {
      return;
    }
    
    try {
      if (!AndroidSpeech.events) {
        return;
      }
      
      this.listeners.push(
        AndroidSpeech.addListener(AndroidSpeech.events.START, (e) => {
          if (this.onSpeechStart) this.onSpeechStart(e);
        })
      );
      
      this.listeners.push(
        AndroidSpeech.addListener(AndroidSpeech.events.END, (e) => {
          if (this.onSpeechEnd) this.onSpeechEnd(e);
        })
      );
      
      this.listeners.push(
        AndroidSpeech.addListener(AndroidSpeech.events.RESULTS, (e) => {
          if (this.onSpeechResults) this.onSpeechResults(e);
        })
      );
      
      this.listeners.push(
        AndroidSpeech.addListener(AndroidSpeech.events.PARTIAL_RESULTS, (e) => {
          if (this.onSpeechPartialResults) this.onSpeechPartialResults(e);
        })
      );
      
      this.listeners.push(
        AndroidSpeech.addListener(AndroidSpeech.events.ERROR, (e) => {
          const isSilentError = e && e.error && (
            e.error.code === 7 || 
            (e.error.code === 5 && this.errorCount > 2)
          );
          
          this.handleSpeechError(e);
          
          if (this.onSpeechError && !isSilentError) {
            this.onSpeechError(e);
          }
        })
      );
      
      if (AndroidSpeech.events.VOLUME_CHANGED) {
        this.listeners.push(
          AndroidSpeech.addListener(AndroidSpeech.events.VOLUME_CHANGED, (e) => {
            if (this.onSpeechVolumeChanged) this.onSpeechVolumeChanged(e);
          })
        );
      }
      
      this.isInitialized = true;
    } catch (e) {
      // Initialization failed
    }
  }
  
  handleSpeechError(e) {
    const now = Date.now();
    const errorCode = e && e.error ? e.error.code : null;
    
    if (now - this.lastErrorTime < 10000) {
      this.errorCount++;
    } else {
      this.errorCount = 1;
    }
    this.lastErrorTime = now;
    
    let shouldRestart = true;
    let cooldownTime = this.restartCooldown;
    
    if (
      (errorCode === 7) || 
      (errorCode === 5 && this.errorCount <= 3)
    ) {
      shouldRestart = true;
    } else if (this.errorCount > 3 || this.restartAttempts >= this.maxRestartAttempts) {
      shouldRestart = true;
      this.restartAttempts = 0;
      cooldownTime = this.errorCooldown;
    }
    
    if (shouldRestart && !this.isInCooldown) {
      log.info(`Entering cooldown for ${cooldownTime}ms`);
      this.isInCooldown = true;
      this.isListening = false;
      
      // Clear any existing cooldown timer
      if (this.cooldownTimer) {
        clearTimeout(this.cooldownTimer);
      }
      
      // Set the cooldown timer
      this.cooldownTimer = setTimeout(() => {
        log.info('Exiting cooldown period');
        this.isInCooldown = false;
        this.restartAttempts++;
        
        // Don't auto-restart here, let the button component handle it
      }, cooldownTime);
    }
  }
  
  async start(language = 'en_US', options = {}) {
    if (Platform.OS !== 'android') {
      log.error('Speech recognition is only available on Android');
      return Promise.reject(new Error('Speech recognition is only available on Android'));
    }
    
    if (!AndroidSpeech) {
      log.error('Speech recognition module not loaded');
      return Promise.reject(new Error('Speech recognition module not loaded'));
    }
    
    if (this.isInCooldown) {
      log.warn('In cooldown period, ignoring start request');
      return Promise.reject(new Error('In cooldown period'));
    }
    
    if (this.isListening) {
      log.info('Already listening, ignoring start request');
      return Promise.resolve();
    }
    
    try {
      // Stop any existing recognition first
      try {
        if (typeof AndroidSpeech.isRecognizing === 'function') {
          const recognizing = await AndroidSpeech.isRecognizing();
          if (recognizing) {
            log.warn('Recognition already in progress, stopping first');
            await AndroidSpeech.stop();
            
            // Add a delay to ensure recognition engine resets
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      } catch (stopError) {
        log.warn(`Error checking/stopping existing recognition: ${stopError.message}`);
      }
      
      const hasPermission = await this.requestMicrophonePermission();
      if (!hasPermission) {
        log.warn('Microphone permission denied');
        return Promise.reject(new Error('Microphone permission denied'));
      }
      
      // Enhance recognition options to improve accuracy
      const recognitionOptions = {
        language,
        maxResults: options.maxResults || 3,
        partialResults: options.partialResults !== false,
        ...options.extraOptions
      };
      
      log.info('Starting voice recognition with options: ' + JSON.stringify(recognitionOptions));
      await AndroidSpeech.start(recognitionOptions);
      
      log.info('Voice recognition started successfully');
      this.isListening = true;
      this.restartAttempts = 0;
      return Promise.resolve();
    } catch (e) {
      this.isListening = false;
      log.error(`Error starting voice recognition: ${e.message}`);
      
      const isCommonError = e && e.message && (
        e.message.includes('already started') || 
        e.message.includes('busy')
      );
      
      if (isCommonError) {
        log.info('Common error detected, treating as success');
        this.isListening = true; // Still mark as listening since engine might be active
        return Promise.resolve();
      }
      
      return Promise.reject(e);
    }
  }
  
  async stop() {
    if (Platform.OS !== 'android' || !AndroidSpeech) {
      return Promise.resolve();
    }
    
    log.info('Stopping voice recognition');
    
    try {
      if (typeof AndroidSpeech.isRecognizing === 'function') {
        const recognizing = await AndroidSpeech.isRecognizing();
        
        if (recognizing) {
          log.info('Recognition in progress, stopping');
          await AndroidSpeech.stop();
        } else {
          log.info('No recognition in progress, nothing to stop');
        }
      } else {
        log.info('Calling stop without checking recognition status');
        await AndroidSpeech.stop();
      }
      
      this.isListening = false;
      log.info('Voice recognition stopped successfully');
      return Promise.resolve();
    } catch (e) {
      log.error(`Error stopping voice recognition: ${e.message}`);
      return Promise.reject(e);
    }
  }
  
  async cancel() {
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
      return Promise.reject(e);
    }
  }
  
  destroy() {
    if (Platform.OS !== 'android' || !AndroidSpeech) {
      return;
    }
    
    try {
      // Clear cooldown timer if active
      if (this.cooldownTimer) {
        clearTimeout(this.cooldownTimer);
        this.cooldownTimer = null;
      }
      
      this.listeners.forEach(listener => {
        if (listener && typeof listener.remove === 'function') {
          listener.remove();
        }
      });
      
      this.listeners = [];
      this.isInitialized = false;
      this.isInCooldown = false;
    } catch (e) {
      // Cleanup failed
      log.error(`Error during destroy: ${e.message}`);
    }
  }
}

export default new VoiceService();
