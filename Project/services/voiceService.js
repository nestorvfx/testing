import { Platform, PermissionsAndroid } from 'react-native';
import * as speechsdk from 'microsoft-cognitiveservices-speech-sdk';
import azureConfig from '../config/azure-config';

// Create better logger for troubleshooting
const log = {
  info: (message) => console.log(`[VoiceService] INFO: ${message}`),
  warn: (message) => console.warn(`[VoiceService] WARN: ${message}`),
  error: (message) => console.error(`[VoiceService] ERROR: ${message}`),
  debug: (message) => console.log(`[VoiceService] DEBUG: ${message}`)
};

// Import AndroidSpeech only on Android platform (keep for backward compatibility)
let AndroidSpeech = null;
if (Platform.OS === 'android') {
  try {
    const speechModule = require('react-native-android-speech');
    AndroidSpeech = speechModule.default || speechModule;
  } catch (e) {
    log.warn('Native Android speech module not available, will use Azure');
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

    // Azure Speech SDK objects
    this.speechConfig = null;
    this.audioConfig = null;
    this.recognizer = null;
    this.useAzure = true; // Default to Azure on all platforms
    
    // Web Speech API objects
    this.webSpeechRecognition = null;
    this.webSpeechSupported = false;
    
    // Debug logging - capture everything in memory for debugging
    this.speechLogs = [];
    this.maxLogEntries = 100;
    
    this.logSpeech('VoiceService initialized');
  }

  // Add detailed logging method that stores history
  logSpeech(message, data = null, level = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data: data ? JSON.stringify(data) : null
    };
    
    // Store in memory for debug overlay
    this.speechLogs.unshift(logEntry);
    if (this.speechLogs.length > this.maxLogEntries) {
      this.speechLogs.pop();
    }
    
    // Also log to console with appropriate level
    const consoleMsg = `[SpeechLog] ${timestamp} ${message}${data ? ': ' + JSON.stringify(data) : ''}`;
    
    switch (level) {
      case 'error':
        console.error(consoleMsg);
        break;
      case 'warn':
        console.warn(consoleMsg);
        break;
      case 'debug':
        console.debug(consoleMsg);
        break;
      default:
        console.log(consoleMsg);
    }
    
    // If we have a log callback, call it
    if (this.onLogMessage) {
      this.onLogMessage(logEntry);
    }
    
    return logEntry;
  }
  
  // Get recent logs for display
  getSpeechLogs(count = 10) {
    return this.speechLogs.slice(0, count);
  }

  async isAvailable() {
    try {
      this.logSpeech('Checking speech availability', { platform: Platform.OS });
      
      // Check if Azure Speech config is available
      if (this.useAzure && (!azureConfig.speech.subscriptionKey || !azureConfig.speech.region)) {
        this.logSpeech('Azure Speech configuration is missing', {
          hasKey: !!azureConfig.speech.subscriptionKey,
          hasRegion: !!azureConfig.speech.region
        }, 'warn');
        this.useAzure = false;
      }
      
      if (Platform.OS === 'android' && AndroidSpeech && !this.useAzure) {
        // Fallback to native Android speech if Azure is not configured
        const available = AndroidSpeech.isSpeechAvailable ? await AndroidSpeech.isSpeechAvailable() : true;
        this.logSpeech('Android native speech availability check', { available });
        return available;
      }
      
      // Check for Web Speech API support in browser environments
      if (Platform.OS === 'web') {
        // Get the appropriate SpeechRecognition constructor
        const SpeechRecognitionAPI = window.SpeechRecognition || 
          window.webkitSpeechRecognition || 
          window.mozSpeechRecognition || 
          window.msSpeechRecognition;
        
        this.webSpeechSupported = !!SpeechRecognitionAPI;
        
        this.logSpeech('Web Speech API availability check', { 
          supported: this.webSpeechSupported,
          standardAPI: !!window.SpeechRecognition,
          webkitAPI: !!window.webkitSpeechRecognition,
          mozAPI: !!window.mozSpeechRecognition,
          msAPI: !!window.msSpeechRecognition
        });
        
        return this.webSpeechSupported;
      }
      
      // Azure Speech is available on all platforms where the SDK is properly installed
      this.logSpeech('Using Azure Speech SDK');
      return true;
    } catch (e) {
      this.logSpeech(`Error checking speech availability: ${e.message}`, { stack: e.stack }, 'error');
      return false;
    }
  }
  
  async requestMicrophonePermission() {
    this.logSpeech('Requesting microphone permission', { platform: Platform.OS });
    
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
        this.logSpeech('Android microphone permission result', { granted, hasPermission });
        return hasPermission;
      } catch (err) {
        this.logSpeech(`Error requesting microphone permission: ${err.message}`, { stack: err.stack }, 'error');
        return false;
      }
    } else if (Platform.OS === 'ios') {
      // iOS handles permissions through Info.plist
      this.logSpeech('iOS microphone permissions handled through Info.plist');
      return true;
    } else if (Platform.OS === 'web') {
      try {
        this.logSpeech('Requesting browser microphone permission');
        
        if (!navigator || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          this.logSpeech('Browser does not support mediaDevices API', null, 'error');
          return false;
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Success! Close the stream since we only needed to request permission
        stream.getTracks().forEach(track => track.stop());
        this.logSpeech('Browser microphone permission granted');
        return true;
      } catch (err) {
        this.logSpeech(`Browser microphone permission denied: ${err.message}`, { name: err.name }, 'error');
        return false;
      }
    } else {
      // Other platforms
      this.logSpeech('Unknown platform - assuming microphone permission');
      return true;
    }
  }

  setup() {
    if (this.isInitialized) {
      this.logSpeech('Speech already initialized, skipping setup');
      return;
    }
    
    this.logSpeech('Setting up speech recognition', { 
      platform: Platform.OS,
      useAzure: this.useAzure,
      webSpeechSupported: this.webSpeechSupported
    });
    
    if (this.useAzure) {
      try {
        // Create speech configuration
        this.logSpeech('Initializing Azure Speech SDK', {
          region: azureConfig.speech.region,
          keyLength: azureConfig.speech.subscriptionKey ? azureConfig.speech.subscriptionKey.length : 0
        });
        
        this.speechConfig = speechsdk.SpeechConfig.fromSubscription(
          azureConfig.speech.subscriptionKey, 
          azureConfig.speech.region
        );
        
        // Set speech recognition language
        this.speechConfig.speechRecognitionLanguage = "en-US";
        
        // Enable continuous recognition
        this.speechConfig.setProperty("SpeechServiceResponse_PostProcessingOption", "TrueText");
        
        this.isInitialized = true;
        this.logSpeech('Azure Speech SDK initialized successfully');
      } catch (e) {
        this.logSpeech(`Error initializing Azure Speech SDK: ${e.message}`, { stack: e.stack }, 'error');
        this.useAzure = false;
      }
    } else if (Platform.OS === 'android' && AndroidSpeech) {
      // Fallback to native Android speech
      try {
        this.logSpeech('Setting up Android native speech recognition');
        
        if (!AndroidSpeech.events) {
          this.logSpeech('Android speech events not available', null, 'warn');
          return;
        }
        
        this.logSpeech('Registering Android speech event listeners');
        
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
        this.logSpeech('Android Speech initialized successfully');
      } catch (e) {
        this.logSpeech(`Error initializing Android Speech: ${e.message}`, { stack: e.stack }, 'error');
      }
    } else if (Platform.OS === 'web') {
      // Initialize Web Speech API for browsers
      try {
        this.logSpeech('Setting up Web Speech API');
        
        // Get the appropriate SpeechRecognition constructor
        const SpeechRecognitionAPI = window.SpeechRecognition || 
                                   window.webkitSpeechRecognition || 
                                   window.mozSpeechRecognition || 
                                   window.msSpeechRecognition;
        
        if (SpeechRecognitionAPI) {
          // Create a new instance using the constructor with new
          this.webSpeechRecognition = new SpeechRecognitionAPI();
          
          this.logSpeech('Configuring Web Speech Recognition', {
            continuous: true,
            interimResults: true,
            language: 'en-US'
          });
          
          this.webSpeechRecognition.continuous = true;
          this.webSpeechRecognition.interimResults = true;
          this.webSpeechRecognition.lang = 'en-US';
          
          this.isInitialized = true;
          this.logSpeech('Web Speech API initialized successfully');
        } else {
          this.logSpeech('No SpeechRecognition API found in browser', null, 'error');
        }
      } catch (e) {
        this.logSpeech(`Error initializing Web Speech API: ${e.message}`, { stack: e.stack }, 'error');
      }
    } else {
      this.logSpeech('No compatible speech recognition system available', { platform: Platform.OS }, 'warn');
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
    
    // Enhanced logging
    this.logSpeech('Speech error handled', { 
      error: e.error,
      errorCode: e.error ? e.error.code : null,
      errorMessage: e.error ? e.error.message : 'Unknown error',
      cooldownTime: cooldownTime,
      isInCooldown: this.isInCooldown,
      restartAttempts: this.restartAttempts
    }, 'error');
  }
  
  async start(language = 'en-US', options = {}) {
    if (this.isInCooldown) {
      this.logSpeech('In cooldown period, ignoring start request', {
        cooldownTimer: !!this.cooldownTimer
      }, 'warn');
      return Promise.reject(new Error('In cooldown period'));
    }
    
    if (this.isListening) {
      this.logSpeech('Already listening, ignoring start request');
      return Promise.resolve();
    }
    
    this.logSpeech('Starting speech recognition', { 
      language, 
      options,
      platform: Platform.OS,
      useAzure: this.useAzure,
      webSpeechSupported: this.webSpeechSupported
    });
    
    try {
      // Stop any existing recognition first
      try {
        await this.stop();
        // Add a delay to ensure recognition engine resets
        this.logSpeech('Waiting for speech engine to reset');
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (stopError) {
        this.logSpeech(`Error stopping existing recognition: ${stopError.message}`, { stack: stopError.stack }, 'warn');
      }
      
      const hasPermission = await this.requestMicrophonePermission();
      if (!hasPermission) {
        this.logSpeech('Microphone permission denied', null, 'error');
        return Promise.reject(new Error('Microphone permission denied'));
      }
      
      if (this.useAzure) {
        // Initialize if not already done
        if (!this.isInitialized) {
          this.logSpeech('Azure not initialized, setting up');
          this.setup();
        }
        
        if (!this.isInitialized) {
          this.logSpeech('Failed to initialize Azure', null, 'error');
          return Promise.reject(new Error('Failed to initialize Azure Speech SDK'));
        }
        
        // Set language if provided
        if (language && this.speechConfig) {
          // Convert language format if needed (e.g., en_US to en-US)
          const formattedLanguage = language.replace('_', '-');
          this.logSpeech('Setting Azure speech language', { language: formattedLanguage });
          this.speechConfig.speechRecognitionLanguage = formattedLanguage;
        }
        
        // Create audio config for microphone
        this.logSpeech('Creating Azure audio config');
        this.audioConfig = speechsdk.AudioConfig.fromDefaultMicrophoneInput();
        
        // Create recognizer
        this.logSpeech('Creating Azure speech recognizer');
        this.recognizer = new speechsdk.SpeechRecognizer(this.speechConfig, this.audioConfig);
        
        // Set up event handlers
        this.logSpeech('Setting up Azure speech event handlers');
        
        this.recognizer.recognizing = (s, e) => {
          // Handle partial results
          if (e.result.reason === speechsdk.ResultReason.RecognizingSpeech) {
            const partialText = e.result.text;
            this.logSpeech('Azure partial speech result', { text: partialText });
            
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
              
              this.logSpeech('Azure simulated volume change', { volume }, 'debug');
            }
          }
        };
        
        this.recognizer.recognized = (s, e) => {
          // Handle final results
          if (e.result.reason === speechsdk.ResultReason.RecognizedSpeech) {
            const finalText = e.result.text;
            this.logSpeech('Azure final speech result', { text: finalText });
            
            if (this.onSpeechResults) {
              this.onSpeechResults({
                value: [finalText]
              });
            }
          } else if (e.result.reason === speechsdk.ResultReason.NoMatch) {
            // No speech detected
            this.logSpeech('Azure no speech match', { reason: 'NoMatch' }, 'warn');
            
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
            this.logSpeech(`Azure speech recognition canceled with error: ${e.errorDetails}`, {
              errorCode: e.errorCode,
              reason: e.reason
            }, 'error');
            
            if (this.onSpeechError) {
              this.onSpeechError({
                error: {
                  code: 5, // Generic error code
                  message: `Azure Speech Error: ${e.errorDetails}`
                }
              });
            }
          } else {
            this.logSpeech('Azure speech recognition canceled', { reason: e.reason });
          }
          this.isListening = false;
        };
        
        this.recognizer.sessionStarted = (s, e) => {
          this.logSpeech('Azure speech recognition started', { sessionId: e.sessionId });
          if (this.onSpeechStart) {
            this.onSpeechStart({});
          }
        };
        
        this.recognizer.sessionStopped = (s, e) => {
          this.logSpeech('Azure speech recognition stopped', { sessionId: e.sessionId });
          this.isListening = false;
          if (this.onSpeechEnd) {
            this.onSpeechEnd({});
          }
        };
        
        // Start continuous recognition
        this.logSpeech('Starting Azure continuous recognition');
        await this.recognizer.startContinuousRecognitionAsync();
        
        this.logSpeech('Azure voice recognition started successfully');
        this.isListening = true;
        this.restartAttempts = 0;
        
        return Promise.resolve();
      } else if (Platform.OS === 'android' && AndroidSpeech) {
        // Fallback to native Android speech if Azure is not available
        // Convert language format if needed (e.g., en-US to en_US)
        const androidLanguage = language.replace('-', '_');
        
        // Enhance recognition options to improve accuracy
        const recognitionOptions = {
          language: androidLanguage,
          maxResults: options.maxResults || 3,
          partialResults: options.partialResults !== false,
          ...options.extraOptions
        };
        
        this.logSpeech('Starting Android native voice recognition', { options: recognitionOptions });
        await AndroidSpeech.start(recognitionOptions);
        
        this.logSpeech('Android native voice recognition started successfully');
        this.isListening = true;
        this.restartAttempts = 0;
        
        return Promise.resolve();
      } else if (Platform.OS === 'web' && this.webSpeechRecognition) {
        // Convert language format if needed
        const formattedLanguage = language.replace('_', '-');
        this.logSpeech('Setting Web Speech API language', { language: formattedLanguage });
        this.webSpeechRecognition.lang = formattedLanguage;
        
        // Set up Web Speech API event handlers
        this.logSpeech('Setting up Web Speech API event handlers');
        
        this.webSpeechRecognition.onstart = () => {
          this.logSpeech('Web Speech recognition started');
          if (this.onSpeechStart) {
            this.onSpeechStart({});
          }
        };
        
        this.webSpeechRecognition.onend = () => {
          this.logSpeech('Web Speech recognition ended');
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
            
            this.logSpeech('Web Speech result', { 
              transcript, 
              confidence, 
              isFinal: result.isFinal,
              resultIndex: event.resultIndex,
              resultLength: event.results.length
            });
            
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
                
                this.logSpeech('Web Speech simulated volume', { 
                  volume: adjustedVolume / 100,
                  confidence
                }, 'debug');
                
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
          this.logSpeech(`Web Speech recognition error: ${event.error}`, {
            errorMessage: event.message,
            errorType: event.error
          }, 'error');
          
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
          this.logSpeech('Web Speech no match', null, 'warn');
          
          if (this.onSpeechError) {
            this.onSpeechError({
              error: {
                code: 7, // Similar to Android SpeechRecognizer.ERROR_NO_MATCH
                message: 'No speech was recognized'
              }
            });
          }
        };
        
        this.webSpeechRecognition.onaudiostart = () => {
          this.logSpeech('Web Speech audio started');
        };
        
        this.webSpeechRecognition.onaudioend = () => {
          this.logSpeech('Web Speech audio ended');
        };
        
        this.webSpeechRecognition.onsoundstart = () => {
          this.logSpeech('Web Speech sound started');
        };
        
        this.webSpeechRecognition.onsoundend = () => {
          this.logSpeech('Web Speech sound ended');
        };
        
        this.webSpeechRecognition.onspeechstart = () => {
          this.logSpeech('Web Speech detected speech starting');
        };
        
        this.webSpeechRecognition.onspeechend = () => {
          this.logSpeech('Web Speech detected speech ending');
        };
        
        // Start Web Speech recognition
        this.logSpeech('Starting Web Speech recognition');
        this.webSpeechRecognition.start();
        
        this.logSpeech('Web Speech recognition started successfully');
        this.isListening = true;
        this.restartAttempts = 0;
        
        return Promise.resolve();
      } else {
        this.logSpeech('Speech recognition not available on this platform', { platform: Platform.OS }, 'error');
        return Promise.reject(new Error('Speech recognition not available on this platform'));
      }
    } catch (e) {
      this.isListening = false;
      this.logSpeech(`Error starting voice recognition: ${e.message}`, { stack: e.stack }, 'error');
      
      const isCommonError = e && e.message && (
        e.message.includes('already started') || 
        e.message.includes('busy')
      );
      
      if (isCommonError) {
        this.logSpeech('Common error detected, treating as success');
        this.isListening = true; // Still mark as listening since engine might be active
        return Promise.resolve();
      }
      
      return Promise.reject(e);
    }
  }
  
  async stop() {
    this.logSpeech('Stopping speech recognition', {
      platform: Platform.OS,
      isListening: this.isListening,
      useAzure: this.useAzure,
      hasWebSpeech: !!this.webSpeechRecognition
    });
    
    if (this.useAzure && this.recognizer) {
      this.logSpeech('Stopping Azure voice recognition');
      
      try {
        await this.recognizer.stopContinuousRecognitionAsync();
        this.isListening = false;
        this.logSpeech('Azure voice recognition stopped successfully');
        return Promise.resolve();
      } catch (e) {
        this.logSpeech(`Error stopping Azure voice recognition: ${e.message}`, { stack: e.stack }, 'error');
        return Promise.reject(e);
      }
    } else if (Platform.OS === 'android' && AndroidSpeech) {
      this.logSpeech('Stopping Android native voice recognition');
      
      try {
        if (typeof AndroidSpeech.isRecognizing === 'function') {
          const recognizing = await AndroidSpeech.isRecognizing();
          
          this.logSpeech('Checking Android recognition status', { recognizing });
          
          if (recognizing) {
            this.logSpeech('Recognition in progress, stopping');
            await AndroidSpeech.stop();
          } else {
            this.logSpeech('No recognition in progress, nothing to stop');
          }
        } else {
          this.logSpeech('Calling stop without checking recognition status');
          await AndroidSpeech.stop();
        }
        
        this.isListening = false;
        this.logSpeech('Android native voice recognition stopped successfully');
        return Promise.resolve();
      } catch (e) {
        this.logSpeech(`Error stopping Android native voice recognition: ${e.message}`, { stack: e.stack }, 'error');
        return Promise.reject(e);
      }
    } else if (Platform.OS === 'web' && this.webSpeechRecognition) {
      this.logSpeech('Stopping Web Speech recognition');
      
      try {
        this.webSpeechRecognition.stop();
        this.isListening = false;
        this.logSpeech('Web Speech recognition stopped successfully');
        return Promise.resolve();
      } catch (e) {
        this.logSpeech(`Error stopping Web Speech recognition: ${e.message}`, { stack: e.stack }, 'error');
        return Promise.reject(e);
      }
    }
    
    return Promise.resolve();
  }
  
  async cancel() {
    this.logSpeech('Cancelling speech recognition');
    return this.stop();
  }
  
  destroy() {
    this.logSpeech('Destroying speech recognition resources');
    
    try {
      if (this.useAzure && this.recognizer) {
        this.logSpeech('Closing Azure recognizer');
        this.recognizer.close();
        this.recognizer = null;
        this.audioConfig = null;
      }
      
      if (Platform.OS === 'android' && !this.useAzure) {
        // Clean up Android listeners
        if (this.listeners && this.listeners.length > 0) {
          this.logSpeech('Removing Android speech listeners', { count: this.listeners.length });
          
          this.listeners.forEach(listener => {
            if (listener && typeof listener.remove === 'function') {
              listener.remove();
            }
          });
          this.listeners = [];
        }
      }
      
      if (Platform.OS === 'web' && this.webSpeechRecognition) {
        this.logSpeech('Cleaning up Web Speech API');
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
      this.logSpeech('Voice recognition resources released');
    } catch (e) {
      this.logSpeech(`Error destroying voice recognition: ${e.message}`, { stack: e.stack }, 'error');
    }
  }
}

export default new VoiceService();
