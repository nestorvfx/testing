import { Platform, PermissionsAndroid } from 'react-native';
import * as speechsdk from 'microsoft-cognitiveservices-speech-sdk';
import azureConfig from '../config/azure-config';

// Simple logger for critical errors only
const log = {
  error: (message) => console.error(`[VoiceService] ERROR: ${message}`)
};

class VoiceService {
  constructor() {
    this.listeners = [];
    this.isInitialized = false;
    this.isListening = false;
    
    // Cooldown tracking for error handling
    this.lastErrorTime = 0;
    this.errorCount = 0;
    this.restartAttempts = 0;
    this.maxRestartAttempts = 5;
    this.restartCooldown = 1500;
    this.errorCooldown = 5000;
    this.isInCooldown = false;
    this.cooldownTimer = null;
    
    // Event handler callbacks
    this.onSpeechStart = null;
    this.onSpeechEnd = null;
    this.onSpeechResults = null;
    this.onSpeechPartialResults = null;
    this.onSpeechError = null;
    this.onSpeechVolumeChanged = null;

    // Azure Speech SDK objects
    this.speechConfig = null;
    this.audioConfig = null;
    this.recognizer = null;
    this.useAzure = true; // Always use Azure
    
    // Web Speech API objects
    this.webSpeechRecognition = null;
    this.webSpeechSupported = false;
  }

  async isAvailable() {
    try {
      // Check if Azure Speech config is available
      if (this.useAzure && (!azureConfig.speech.subscriptionKey || !azureConfig.speech.region)) {
        return false; // No fallback anymore, return false if Azure is not configured
      }
      
      // Check for Web Speech API support in browser environments
      if (Platform.OS === 'web') {
        // Get the appropriate SpeechRecognition constructor
        const SpeechRecognitionAPI = window.SpeechRecognition || 
          window.webkitSpeechRecognition || 
          window.mozSpeechRecognition || 
          window.msSpeechRecognition;
        
        this.webSpeechSupported = !!SpeechRecognitionAPI;
        return this.webSpeechSupported;
      }
      
      // Azure Speech is available on all platforms where the SDK is properly installed
      return true;
    } catch (e) {
      return false;
    }
  }
  
  async requestMicrophonePermission() {
    if (Platform.OS === 'android') {
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
        
        const hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
        return hasPermission;
      } catch (err) {
        return false;
      }
    } else if (Platform.OS === 'ios') {
      // iOS handles permissions through Info.plist
      return true;
    } else if (Platform.OS === 'web') {
      try {
        if (!navigator || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          return false;
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Success! Close the stream since we only needed to request permission
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch (err) {
        return false;
      }
    } else {
      // Other platforms
      return true;
    }
  }

  setup() {
    if (this.isInitialized) {
      return;
    }
    
    if (this.useAzure) {
      try {
        // Create speech configuration
        this.speechConfig = speechsdk.SpeechConfig.fromSubscription(
          azureConfig.speech.subscriptionKey, 
          azureConfig.speech.region
        );
        
        // Set speech recognition language
        this.speechConfig.speechRecognitionLanguage = "en-US";
        
        // Enable continuous recognition
        this.speechConfig.setProperty("SpeechServiceResponse_PostProcessingOption", "TrueText");
        
        // Add additional properties for Android to improve microphone access
        if (Platform.OS === 'android') {
          // Set audio processing options for better Android compatibility
          this.speechConfig.setProperty("Audio_AudioProcessingOptions", "2"); // Default audio processing
          
          // Critical properties for Android microphone
          this.speechConfig.setProperty("Speech_SegmentationSilenceTimeoutMs", "500");
          this.speechConfig.setProperty("SPEECH-AudioSessionCategoryType", "PlayAndRecord");
          this.speechConfig.setProperty("SPEECH-AudioSessionMode", "Default");
          this.speechConfig.setProperty("SPEECH-AudioRecordingGain", "1.0");
          this.speechConfig.setProperty("SPEECH-AllowBackgroundAudioProcessing", "1");
        }
        
        this.isInitialized = true;
      } catch (e) {
        log.error(`Error initializing Azure Speech SDK: ${e.message}`);
        this.useAzure = false;
        this.isInitialized = false;
      }
    } else if (Platform.OS === 'web') {
      // Initialize Web Speech API for browsers
      try {
        // Get the appropriate SpeechRecognition constructor
        const SpeechRecognitionAPI = window.SpeechRecognition || 
                                   window.webkitSpeechRecognition || 
                                   window.mozSpeechRecognition || 
                                   window.msSpeechRecognition;
        
        if (SpeechRecognitionAPI) {
          // Create a new instance using the constructor with new
          this.webSpeechRecognition = new SpeechRecognitionAPI();
          
          this.webSpeechRecognition.continuous = true;
          this.webSpeechRecognition.interimResults = true;
          this.webSpeechRecognition.lang = 'en-US';
          
          this.isInitialized = true;
        }
      } catch (e) {
        log.error(`Error initializing Web Speech API: ${e.message}`);
      }
    }
  }
  
  handleSpeechError(e) {
    const now = Date.now();
    
    if (now - this.lastErrorTime < 10000) {
      this.errorCount++;
    } else {
      this.errorCount = 1;
    }
    this.lastErrorTime = now;
    
    let shouldRestart = true;
    let cooldownTime = this.restartCooldown;
    
    if (this.errorCount > 3 || this.restartAttempts >= this.maxRestartAttempts) {
      shouldRestart = true;
      this.restartAttempts = 0;
      cooldownTime = this.errorCooldown;
    }
    
    if (shouldRestart && !this.isInCooldown) {
      this.isInCooldown = true;
      this.isListening = false;
      
      // Clear any existing cooldown timer
      if (this.cooldownTimer) {
        clearTimeout(this.cooldownTimer);
      }
      
      // Set the cooldown timer
      this.cooldownTimer = setTimeout(() => {
        this.isInCooldown = false;
        this.restartAttempts++;
      }, cooldownTime);
    }
  }
  
  async start(language = 'en-US', options = {}) {
    if (this.isInCooldown) {
      return Promise.reject(new Error('In cooldown period'));
    }
    
    if (this.isListening) {
      return Promise.resolve();
    }
    
    try {
      // Stop any existing recognition first
      try {
        await this.stop();
        // Add a delay to ensure recognition engine resets
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (stopError) {
        // Silently continue if stop fails
      }
      
      const hasPermission = await this.requestMicrophonePermission();
      if (!hasPermission) {
        return Promise.reject(new Error('Microphone permission denied'));
      }
      
      if (this.useAzure) {
        // Initialize if not already done
        if (!this.isInitialized) {
          this.setup();
        }
        
        if (!this.isInitialized) {
          return Promise.reject(new Error('Failed to initialize Azure Speech SDK'));
        }
        
        // Set language if provided
        if (language && this.speechConfig) {
          // Convert language format if needed (e.g., en_US to en-US)
          const formattedLanguage = language.replace('_', '-');
          this.speechConfig.speechRecognitionLanguage = formattedLanguage;
        }
        
        // Create audio config for microphone
        this.audioConfig = speechsdk.AudioConfig.fromDefaultMicrophoneInput();
        
        // Create recognizer
        this.recognizer = new speechsdk.SpeechRecognizer(this.speechConfig, this.audioConfig);
        
        // Set up event handlers
        this.recognizer.recognizing = (s, e) => {
          // Handle partial results
          if (e.result.reason === speechsdk.ResultReason.RecognizingSpeech) {
            const partialText = e.result.text;
            
            if (this.onSpeechPartialResults) {
              this.onSpeechPartialResults({
                value: [partialText]
              });
            }
            
            // Simulate volume change events
            if (this.onSpeechVolumeChanged) {
              // Send volume updates at regular intervals
              const volume = 0.5 + (Math.random() * 0.3); // Random between 0.5-0.8
              this.onSpeechVolumeChanged({
                value: volume
              });
            }
          }
        };
        
        this.recognizer.recognized = (s, e) => {
          // Handle final results
          if (e.result.reason === speechsdk.ResultReason.RecognizedSpeech) {
            const finalText = e.result.text;
            
            if (this.onSpeechResults) {
              this.onSpeechResults({
                value: [finalText]
              });
            }
          } else if (e.result.reason === speechsdk.ResultReason.NoMatch) {
            // No speech detected
            if (this.onSpeechError) {
              this.onSpeechError({
                error: {
                  code: 7, // Similar to Android SpeechRecognizer.ERROR_NO_MATCH
                  message: 'No speech was recognized'
                }
              });
            }
          }
        };
        
        this.recognizer.canceled = (s, e) => {
          if (e.reason === speechsdk.CancellationReason.Error) {
            if (this.onSpeechError) {
              this.onSpeechError({
                error: {
                  code: 5, // Generic error code
                  message: `Azure Speech Error: ${e.errorDetails}`
                }
              });
            }
          }
          this.isListening = false;
        };
        
        this.recognizer.sessionStarted = (s, e) => {
          if (this.onSpeechStart) {
            this.onSpeechStart({});
          }
        };
        
        this.recognizer.sessionStopped = (s, e) => {
          this.isListening = false;
          if (this.onSpeechEnd) {
            this.onSpeechEnd({});
          }
        };
        
        // Start continuous recognition
        await this.recognizer.startContinuousRecognitionAsync();
        
        this.isListening = true;
        this.restartAttempts = 0;
        
        return Promise.resolve();
      } else if (Platform.OS === 'web' && this.webSpeechRecognition) {
        // Convert language format if needed
        const formattedLanguage = language.replace('_', '-');
        this.webSpeechRecognition.lang = formattedLanguage;
        
        // Set up Web Speech API event handlers
        this.webSpeechRecognition.onstart = () => {
          if (this.onSpeechStart) {
            this.onSpeechStart({});
          }
        };
        
        this.webSpeechRecognition.onend = () => {
          this.isListening = false;
          if (this.onSpeechEnd) {
            this.onSpeechEnd({});
          }
        };
        
        this.webSpeechRecognition.onresult = (event) => {
          if (event.results.length > 0) {
            const result = event.results[event.results.length - 1];
            const transcript = result[0].transcript;
            const confidence = result[0].confidence;
            
            // Send partial results
            if (!result.isFinal) {
              if (this.onSpeechPartialResults) {
                this.onSpeechPartialResults({
                  value: [transcript]
                });
              }
              
              // Simulate volume change (not directly available in Web Speech API)
              if (this.onSpeechVolumeChanged) {
                // Use confidence as a factor to simulate volume level
                const randomVolume = 50 + Math.floor(Math.random() * 45); // Random 50-95%
                const adjustedVolume = randomVolume * (confidence || 0.5); // Adjust by confidence
                
                this.onSpeechVolumeChanged({
                  value: adjustedVolume / 100 // Normalize to 0-1 range
                });
              }
            } else {
              // Final results
              if (this.onSpeechResults) {
                this.onSpeechResults({
                  value: [transcript]
                });
              }
            }
          }
        };
        
        this.webSpeechRecognition.onerror = (event) => {
          if (this.onSpeechError) {
            this.onSpeechError({
              error: {
                code: 5, // Generic error code
                message: `Web Speech API Error: ${event.error}`
              }
            });
          }
        };
        
        this.webSpeechRecognition.onnomatch = () => {
          if (this.onSpeechError) {
            this.onSpeechError({
              error: {
                code: 7, // Similar to Android SpeechRecognizer.ERROR_NO_MATCH
                message: 'No speech was recognized'
              }
            });
          }
        };
        
        // Start Web Speech recognition
        this.webSpeechRecognition.start();
        
        this.isListening = true;
        this.restartAttempts = 0;
        
        return Promise.resolve();
      } else {
        return Promise.reject(new Error('Speech recognition not available on this platform'));
      }
    } catch (e) {
      this.isListening = false;
      
      const isCommonError = e && e.message && (
        e.message.includes('already started') || 
        e.message.includes('busy')
      );
      
      if (isCommonError) {
        this.isListening = true; // Still mark as listening since engine might be active
        return Promise.resolve();
      }
      
      return Promise.reject(e);
    }
  }
  
  async stop() {
    if (this.useAzure && this.recognizer) {
      try {
        await this.recognizer.stopContinuousRecognitionAsync();
        this.isListening = false;
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(e);
      }
    } else if (Platform.OS === 'web' && this.webSpeechRecognition) {
      try {
        this.webSpeechRecognition.stop();
        this.isListening = false;
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(e);
      }
    }
    
    return Promise.resolve();
  }
  
  async cancel() {
    return this.stop();
  }
  
  destroy() {
    try {
      if (this.useAzure && this.recognizer) {
        this.recognizer.close();
        this.recognizer = null;
        this.audioConfig = null;
      }
      
      if (Platform.OS === 'web' && this.webSpeechRecognition) {
        // Remove all event handlers
        this.webSpeechRecognition.onstart = null;
        this.webSpeechRecognition.onend = null;
        this.webSpeechRecognition.onresult = null;
        this.webSpeechRecognition.onerror = null;
        this.webSpeechRecognition.onnomatch = null;
        this.webSpeechRecognition.onaudiostart = null;
        this.webSpeechRecognition.onaudioend = null;
        this.webSpeechRecognition.onsoundstart = null;
        this.webSpeechRecognition.onsoundend = null;
        this.webSpeechRecognition.onspeechstart = null;
        this.webSpeechRecognition.onspeechend = null;
        
        this.webSpeechRecognition = null;
      }
      
      this.isListening = false;
    } catch (e) {
      log.error(`Error destroying voice recognition: ${e.message}`);
    }
  }
}

export default new VoiceService();
