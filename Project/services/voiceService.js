/**
 * Voice Service
 * Provides speech recognition capabilities with primary implementation through 
 * react-native-azure-continuous-speech custom module on Android devices
 */
import { Platform, PermissionsAndroid } from 'react-native';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { setupWebSpeechFallback, setupAndroidContinuousFallback } from './speechRecognitionFallback';

// Configuration values for Azure Speech Service
const AZURE_CONFIG = {
  speech: {
    subscriptionKey: '4zVpnnP5CnZ4TdOXEJKx12kGwYulddbsdLzftLgbU4q4iNdnEiY6JQQJ99BEACi5YpzXJ3w3AAAYACOGlNhJ', // Replace with your key
    region: 'northeurope',                      // Replace with your region
  },
  speechRecognitionLanguage: 'en-US',
};

class VoiceService {
  constructor() {
    // Service state
    this.isInitialized = false;
    this.isListening = false;
    this.useAndroidCustomModule = Platform.OS === 'android';
    this.recognizer = null;
    this.androidModule = null;

    // Callbacks that will be set by consumers
    this.onSpeechStart = null;
    this.onSpeechEnd = null;
    this.onSpeechResults = null;
    this.onSpeechPartialResults = null;
    this.onSpeechError = null;
    this.onSpeechVolumeChanged = null;
    
    // Add fast processing flag
    this.fastProcessing = true;
  }

  /**
   * Request microphone permission
   * @returns {Promise<boolean>} Whether permission was granted
   */
  async requestMicrophonePermission() {
    try {
      if (Platform.OS === 'android') {
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
      } else {
        // iOS and Web: For iOS, this is handled via app.json / info.plist
        return true;
      }
    } catch (err) {
      console.error('Error requesting microphone permission:', err);
      return false;
    }
  }
  /**
   * Initialize Android custom module
   * @private
   */
  async _initializeAndroidModule() {
    try {
      // Reduced logging
      this.androidModule = await setupAndroidContinuousFallback(AZURE_CONFIG);
      
      if (this.androidModule) {
        // Configure event handlers
        await this.androidModule.configureListeners({
          onSpeechStart: (event) => {
            if (this.onSpeechStart) this.onSpeechStart(event);
          },
          onSpeechEnd: (event) => {
            if (this.onSpeechEnd) this.onSpeechEnd(event);
            this.isListening = false;
          },
          onSpeechResults: (results) => {
            if (this.onSpeechResults) this.onSpeechResults(results);
          },
          onSpeechPartialResults: (results) => {
            if (this.onSpeechPartialResults) this.onSpeechPartialResults(results);
          },
          onSpeechError: (error) => {
            if (this.onSpeechError) this.onSpeechError(error);
            this.isListening = false;
          }
        });

        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Error initializing Android module:', error);
      return false;
    }
  }  /**
   * Start speech recognition
   * @param {string} language - Language code for speech recognition (e.g., 'en-US')
   * @returns {Promise<void>}
   */
  async start(language = 'en-US') {
    // Prevent multiple starts
    if (this.isListening) {
      console.log('[VOICE_DEBUG] start() called but already listening');
      return;
    }

    console.log('[VOICE_DEBUG] Starting speech recognition with language:', language);
    try {
      // Initialize service if needed
      if (!this.isInitialized) {
        console.log('[VOICE_DEBUG] Service not initialized, initializing now');
        await this.initialize(language);
      } else {
        // If already initialized but not listening, make sure we reset any internal state
        // This helps ensure a clean start for the new recognition session
        if (Platform.OS === 'android' && this.androidModule) {
          console.log('[VOICE_DEBUG] Restarting Android module cleanly');
          // Trying to restart the Android module more cleanly
          try {
            await this.androidModule.stop();
            console.log('[VOICE_DEBUG] Successfully stopped Android module');
            // Small delay before starting again
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (e) {
            console.warn('[VOICE_DEBUG] Error during Android module restart:', e.message);
            // Ignore errors during reset - just continue with start
          }
        }
      }      // For Android, prioritize the custom module
      if (Platform.OS === 'android' && this.androidModule) {
        console.log('[VOICE_DEBUG] Using Android custom module to start recognition');
        await this.androidModule.start();
        this.isListening = true;
        console.log('[VOICE_DEBUG] Android module started successfully');
        
        if (this.onSpeechStart) {
          console.log('[VOICE_DEBUG] Manually triggering onSpeechStart event');
          this.onSpeechStart();
        }
        return;
      }

      // For other platforms or if Android module fails
      console.log('[VOICE_DEBUG] Using fallback recognition method');
      this._startFallbackRecognition(language);
    } catch (error) {
      console.error('[VOICE_DEBUG] Error starting speech recognition:', error.message, error.stack);
      if (this.onSpeechError) {
        this.onSpeechError({
          error: 'start_error', 
          message: error.message || 'Failed to start speech recognition'
        });
      }
      throw error;
    }
  }
    /**
   * Stop speech recognition
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.isListening) {
      console.log('[VOICE_DEBUG] stop() called but not listening');
      return;
    }

    console.log('[VOICE_DEBUG] Stopping speech recognition');
    try {
      // For Android, use the custom module if available
      if (Platform.OS === 'android' && this.androidModule) {
        console.log('[VOICE_DEBUG] Using Android custom module to stop');
        await this.androidModule.stop();
        console.log('[VOICE_DEBUG] Android module stopped successfully');
      } 
      // Fallback for other platforms
      else if (this.recognizer) {
        console.log('[VOICE_DEBUG] Using fallback method to stop');
        this._stopFallbackRecognition();
      }
    } catch (error) {
      console.error('[VOICE_DEBUG] Error stopping speech recognition:', error.message, error.stack);
    } finally {
      this.isListening = false;
      console.log('[VOICE_DEBUG] isListening set to false');
      
      // Explicitly trigger the onSpeechEnd event if it hasn't been triggered
      if (this.onSpeechEnd) {
        console.log('[VOICE_DEBUG] Manually triggering onSpeechEnd event');
        this.onSpeechEnd();
      }
    }
  }
    /**
   * Reset speech recognition - stops and restarts to ensure a clean state
   * @param {string} language - Language code for speech recognition (e.g., 'en-US')
   * @returns {Promise<void>}
   */
  async reset(language = 'en-US') {
    console.log('[VOICE_DEBUG] Reset called with language:', language);
    try {
      // Stop current recognition if active
      if (this.isListening) {
        console.log('[VOICE_DEBUG] Currently listening, stopping first');
        await this.stop();
        console.log('[VOICE_DEBUG] Stop completed during reset');
      } else {
        console.log('[VOICE_DEBUG] Not currently listening, proceeding with reset');
      }
      
      // Record pre-delay state for debugging
      console.log('[VOICE_DEBUG] Pre-delay state - isInitialized:', this.isInitialized, 'isListening:', this.isListening);
      
      // Short delay to ensure clean restart
      console.log('[VOICE_DEBUG] Adding delay before restart');
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Record post-delay state for debugging
      console.log('[VOICE_DEBUG] Post-delay state - isInitialized:', this.isInitialized, 'isListening:', this.isListening);
      
      // Start fresh
      console.log('[VOICE_DEBUG] Starting recognition after reset');
      await this.start(language);
      console.log('[VOICE_DEBUG] Reset completed successfully');
    } catch (error) {
      console.error('[VOICE_DEBUG] Error resetting speech recognition:', error.message, error.stack);
      if (this.onSpeechError) {
        this.onSpeechError({
          error: 'reset_error',
          message: error.message || 'Failed to reset speech recognition'
        });
      }
    }
  }

  /**
   * Initialize the service
   * @param {string} language - Language code for speech recognition (e.g., 'en-US')
   * @private
   */
  async initialize(language = 'en-US') {
    try {      // For Android, try the custom module first
      if (Platform.OS === 'android') {
        const androidInitialized = await this._initializeAndroidModule();
        if (androidInitialized) {
          this.isInitialized = true;
          return;
        }
      }

      // Fallback to web implementation or other fallbacks
      await this._initializeFallbackRecognition(language);
      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing speech recognition:', error);
      throw error;
    }
  }

  /**
   * Initialize fallback recognition mechanisms
   * @param {string} language - Language code
   * @private
   */
  async _initializeFallbackRecognition(language) {
    // Try Web Speech API for web platform
    if (Platform.OS === 'web') {
      this.recognizer = setupWebSpeechFallback();
      if (this.recognizer) {
        console.log('Web Speech API initialized');
        return;
      }
    }

    // Use Azure Speech SDK as another fallback
    try {
      console.log('Initializing Azure Speech SDK fallback...');
      
      // Create the SpeechConfig
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
        AZURE_CONFIG.speech.subscriptionKey,
        AZURE_CONFIG.speech.region
      );
      
      speechConfig.speechRecognitionLanguage = language;

      // Create the audio config
      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      
      // Create the speech recognizer
      this.recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
      console.log('Azure Speech SDK initialized');
    } catch (error) {
      console.error('Error initializing Azure Speech SDK:', error);
      throw error;
    }
  }

  /**
   * Start fallback recognition
   * @param {string} language - Language code
   * @private
   */
  _startFallbackRecognition(language) {
    // Handle Web Speech API
    if (Platform.OS === 'web' && this.recognizer) {
      this.recognizer.onstart = () => {
        this.isListening = true;
        if (this.onSpeechStart) this.onSpeechStart();
      };
      
      this.recognizer.onend = () => {
        this.isListening = false;
        if (this.onSpeechEnd) this.onSpeechEnd();
      };
      
      this.recognizer.onresult = (event) => {
        // Get the transcript from the results
        const transcript = event.results[0][0].transcript;
        const isFinal = event.results[0].isFinal;
        
        // Process the results
        const results = {
          value: [transcript],
          isFinal: isFinal
        };
        
        if (isFinal && this.onSpeechResults) {
          this.onSpeechResults(results);
        } else if (!isFinal && this.onSpeechPartialResults) {
          this.onSpeechPartialResults(results);
        }
      };
      
      this.recognizer.onerror = (event) => {
        if (this.onSpeechError) {
          this.onSpeechError({
            error: event.error,
            message: event.message || `Web Speech API error: ${event.error}`
          });
        }
      };
      
      this.recognizer.start();
      return;
    }

    // Handle Azure SDK fallback
    if (this.recognizer) {
      try {
        console.log('Starting Azure SDK recognition');
        
        // Set up event handlers
        this.recognizer.recognizing = (sender, event) => {
          if (this.onSpeechPartialResults) {
            this.onSpeechPartialResults({
              value: [event.result.text],
              isFinal: false
            });
          }
        };
        
        this.recognizer.recognized = (sender, event) => {
          if (this.onSpeechResults) {
            this.onSpeechResults({
              value: [event.result.text],
              isFinal: true
            });
          }
        };
        
        this.recognizer.canceled = (sender, event) => {
          if (this.onSpeechError) {
            this.onSpeechError({
              error: 'recognition_canceled',
              message: `Recognition canceled: ${event.errorDetails || event.reason}`
            });
          }
        };
        
        this.recognizer.sessionStarted = (sender, event) => {
          this.isListening = true;
          if (this.onSpeechStart) this.onSpeechStart();
        };
        
        this.recognizer.sessionStopped = (sender, event) => {
          this.isListening = false;
          if (this.onSpeechEnd) this.onSpeechEnd();
        };
        
        // Start continuous recognition
        this.recognizer.startContinuousRecognitionAsync(
          () => console.log('Continuous recognition started'),
          (error) => {
            console.error('Error starting recognition:', error);
            if (this.onSpeechError) {
              this.onSpeechError({
                error: 'start_recognition_error',
                message: error.message || 'Failed to start recognition'
              });
            }
          }
        );
      } catch (error) {
        console.error('Error in Azure SDK recognition:', error);
        if (this.onSpeechError) {
          this.onSpeechError({
            error: 'azure_sdk_error',
            message: error.message || 'Azure Speech SDK error'
          });
        }
      }
    }
  }

  /**
   * Stop fallback recognition
   * @private
   */
  _stopFallbackRecognition() {
    // Web Speech API
    if (Platform.OS === 'web' && this.recognizer) {
      this.recognizer.stop();
      return;
    }

    // Azure SDK
    if (this.recognizer) {
      try {
        this.recognizer.stopContinuousRecognitionAsync(
          () => console.log('Recognition stopped'),
          (error) => console.error('Error stopping recognition:', error)
        );
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
    }
  }

  /**
   * Clean up resources
   */
  async destroy() {
    try {
      if (this.isListening) {
        await this.stop();
      }

      // Clean up Android module
      if (Platform.OS === 'android' && this.androidModule) {
        if (this.androidModule.destroy) {
          await this.androidModule.destroy();
        }
        this.androidModule = null;
      }

      // Clean up other resources
      if (this.recognizer) {
        this.recognizer.close ? this.recognizer.close() : null;
        this.recognizer = null;
      }
      
      this.isInitialized = false;
    } catch (error) {
      console.error('Error destroying speech recognition:', error);
    }
  }
}

// Export a singleton instance
export default new VoiceService();
