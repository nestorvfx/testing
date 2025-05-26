/**
 * Oracle Cloud Infrastructure (OCI) Voice Service
 * Provides speech recognition capabilities using OCI Speech to Text API
 * through WebSockets for real-time audio streaming and transcription.
 */
import { Platform } from 'react-native';
import { Audio } from 'expo-audio';
import OCIVoiceNative from '../custom-modules/react-native-oci-voice';
import { requestMicrophonePermission, checkMicrophonePermission } from '../utils/permissions';

// Configuration for the authentication server
const AUTH_SERVER_URL = Platform.OS === 'web' 
  ? 'http://localhost:8450'  // OCI Speech server
  : 'http://192.168.8.101:8450'; // OCI Speech server - use computer's IP for Android

class OCIVoiceService {
  constructor() {
    // Service state
    this.isInitialized = false;
    this.isListening = false;
    this.webSocket = null;
    this.audioContext = null;
    this.mediaStream = null;
    this.audioProcessor = null;
    this.reconnectAttempted = false;
      // Session token info
    this.sessionToken = null;
    this.sessionId = null;
    this.compartmentId = null;
    this.tokenExpiresAt = null;
    this.region = null;
    
    // Callbacks that will be set by consumers
    this.onSpeechStart = null;
    this.onSpeechEnd = null;
    this.onSpeechResults = null;
    this.onSpeechPartialResults = null;
    this.onSpeechError = null;
    this.onSpeechVolumeChanged = null;
  }
  /**
   * Initialize the voice service by setting up audio context and permissions
   */  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {        if (Platform.OS === 'android') {
        const hasPermission = await requestMicrophonePermission();
        if (!hasPermission) {
          throw new Error('Microphone permission is required for speech recognition');
        }
      } else if (Platform.OS === 'ios') {
        // For iOS, use Expo Audio API
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          throw new Error('Microphone permission not granted');
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: true,
        });      } else {
        // For Web, permissions are handled by the browser
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize OCI Voice Service:', error);
      throw error;
    }
  }
  /**
   * Get authentication token from the server
   */  async getAuthToken() {
    try {
      const response = await fetch(`${AUTH_SERVER_URL}/authenticate`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.token) {
        throw new Error('No token received from authentication server');
      }      this.sessionToken = data.token;
      this.sessionId = data.sessionId;
      this.compartmentId = data.compartmentId;
      this.tokenExpiresAt = Date.now() + (55 * 60 * 1000);
      
      return data.token;
    } catch (error) {
      console.error('Failed to get authentication token:', error);
      throw error;
    }
  }

  /**
   * Get region from the server
   */
  async getRegion() {
    try {
      const response = await fetch(`${AUTH_SERVER_URL}/region`);
      if (!response.ok) {
        throw new Error(`Failed to get region: ${response.statusText}`);
      }
      const data = await response.json();
      this.region = data.region;
      return this.region;
    } catch (error) {
      console.error('Failed to get region:', error);
      throw error;
    }
  }
  /**
   * Check if token is valid and not expired
   */
  isTokenValid() {
    return this.sessionToken && 
           this.tokenExpiresAt && 
           Date.now() < this.tokenExpiresAt;
  }

  /**
   * Ensure we have a valid token, refreshing if necessary
   */  async ensureValidToken() {
    if (!this.isTokenValid()) {
      await this.getAuthToken();
      if (!this.region) {
        await this.getRegion();
      }
    }
    return this.sessionToken;
  }
  /**
   * Set up WebSocket connection to OCI Speech service
   */
  async setupWebSocket() {
    try {
      // Ensure we have a valid token
      await this.ensureValidToken();

      // Get region if not already set
      if (!this.region) {
        await this.getRegion();
      }

      // Build WebSocket URL
      const baseUrl = `wss://realtime.aiservice.${this.region}.oci.oraclecloud.com/ws/transcribe/stream`;
      const params = new URLSearchParams({
        'isAckEnabled': 'false',
        'partialSilenceThresholdInMs': '0',
        'finalSilenceThresholdInMs': '1000',
        'stabilizePartialResults': 'NONE',
        'shouldIgnoreInvalidCustomizations': 'false',
        'languageCode': 'en-US',
        'modelDomain': 'GENERIC',
        'punctuation': 'NONE',
        'encoding': 'audio/raw;rate=16000'      });

      const websocketUrl = `${baseUrl}?${params.toString()}`;

      this.webSocket = new WebSocket(websocketUrl);

      this.webSocket.onopen = () => {
        const authMessage = {
          authenticationType: "TOKEN",
          token: this.sessionToken,
          compartmentId: this.compartmentId
        };
          this.webSocket.send(JSON.stringify(authMessage));
      };

      this.webSocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.event === "CONNECT") {
            this.startAudioCapture();
          } else if (message.event === "RESULT") {
            this.handleTranscriptionResult(message);          } else if (message.event === "ERROR") {
            if (this.onSpeechError) {
              this.onSpeechError({
                error: 'speech_service_error',
                message: message.message || 'Speech service error'
              });
            }
          }        } catch (err) {
          if (this.onSpeechError) {
            this.onSpeechError({
              error: 'message_parse_error',
              message: 'Error parsing server response'
            });
          }
        }
      };      this.webSocket.onerror = (error) => {
        if (this.onSpeechError) {
          this.onSpeechError({
            error: 'websocket_error',
            message: 'WebSocket connection error'
          });
        }
      };      this.webSocket.onclose = (event) => {
        this.isListening = false;
        
        if (this.onSpeechEnd) {
          this.onSpeechEnd();
        }
          if (event.code !== 1000) {
          if (this.onSpeechError) {
            this.onSpeechError({
              error: 'connection_closed',
              message: `Connection closed: ${event.code} ${event.reason || ''}`
            });
          }
        }
      };    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle transcription results from OCI Speech service
   */
  handleTranscriptionResult(message) {
    const transcriptions = message.transcriptions;
    if (transcriptions && transcriptions.length > 0) {
      const result = transcriptions[0];
        if (result.isFinal) {
        if (this.onSpeechResults) {
          this.onSpeechResults({
            value: [result.transcription],
            isFinal: true
          });
        }      } else {
        if (this.onSpeechPartialResults) {
          this.onSpeechPartialResults({
            value: [result.transcription],
            isFinal: false
          });
        }
      }
    }
  }

  /**
   * Set up audio capture for web platform
   */
  async startAudioCapture() {
    try {      if (Platform.OS !== 'web') {
        this.isListening = true;
        if (this.onSpeechStart) {
          this.onSpeechStart();
        }
        return;
      }

      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });

      // Create audio source and processor
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.audioProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

      // Process audio data
      this.audioProcessor.onaudioprocess = (event) => {
        if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
          const inputBuffer = event.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);
          
          // Convert to 16-bit PCM
          const pcmData = this.convertFloat32ToInt16(inputData);
          this.webSocket.send(pcmData.buffer);
          
          // Calculate volume for UI feedback
          const volume = this.calculateVolume(inputData);
          if (this.onSpeechVolumeChanged) {
            this.onSpeechVolumeChanged(volume);
          }
        }
      };

      // Connect audio nodes
      source.connect(this.audioProcessor);
      this.audioProcessor.connect(this.audioContext.destination);

      this.isListening = true;
      console.log('Audio capture started successfully');
      
      if (this.onSpeechStart) {
        this.onSpeechStart();
      }
      
    } catch (error) {
      console.error('Error setting up audio capture:', error);
      if (this.onSpeechError) {
        this.onSpeechError({
          error: 'audio_setup_error',
          message: 'Failed to access microphone'
        });
      }
    }
  }

  /**
   * Convert Float32Array to Int16Array (16-bit PCM)
   */
  convertFloat32ToInt16(buffer) {
    const length = buffer.length;
    const result = new Int16Array(length);
    
    for (let i = 0; i < length; i++) {
      const clampedValue = Math.min(1, Math.max(-1, buffer[i]));
      result[i] = clampedValue * 0x7FFF;
    }
    
    return result;
  }

  /**
   * Calculate audio volume for UI feedback
   */
  calculateVolume(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }
  /**
   * Stop audio capture and clean up resources
   */
  async stopAudioCapture() {
    try {
      if (this.audioProcessor) {
        this.audioProcessor.disconnect();
        this.audioProcessor = null;
      }

      if (this.audioContext && this.audioContext.state !== 'closed') {
        await this.audioContext.close();
        this.audioContext = null;
      }

      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }

      console.log('Audio capture stopped');
    } catch (error) {
      console.error('Error stopping audio capture:', error);
    }
  }

  /**
   * Close WebSocket connection
   */
  closeWebSocket() {
    if (this.webSocket) {
      if (this.webSocket.readyState === WebSocket.OPEN) {
        this.webSocket.close();
      }
      this.webSocket = null;
    }
  }  /**
   * Clean up all resources
   */
  async cleanup() {
    try {
      // For Android, just reset the token state
      if (Platform.OS === 'android') {
        // Reset token information to force a fresh token on next start
        // OCI real-time tokens appear to be single-use
        this.sessionToken = null;
        this.sessionId = null;
        this.tokenExpiresAt = 0;
      } else {
        // For Web, clean up audio and WebSocket
        await this.stopAudioCapture();
        this.closeWebSocket();
      }
      
      this.isListening = false;
      
      // Reset token information to force a fresh token on next start
      // OCI real-time tokens appear to be single-use
      this.sessionToken = null;
      this.sessionId = null;
      this.tokenExpiresAt = 0;
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  // Public API Methods
  /**
   * Start speech recognition
   */
  async startListening() {
    if (this.isListening) {
      console.log('Already listening, ignoring start request');
      return;
    }

    try {
      console.log('Starting OCI speech recognition...');
      
      if (!this.isInitialized) {
        await this.initialize();
      }      // For Android, use the native module
      if (Platform.OS === 'android') {
        // Double-check microphone permission before starting
        const hasPermission = await checkMicrophonePermission();
        if (!hasPermission) {
          throw new Error('Microphone permission is required. Please grant permission and try again.');
        }
        
        // Make sure token is fresh
        await this.ensureValidToken();
        
        // Initialize the native module if needed
        if (!OCIVoiceNative.isInitialized) {
          const initResult = await OCIVoiceNative.initialize({
            region: this.region
          });
          
          if (!initResult) {
            throw new Error('Failed to initialize Android native module');
          }
        }
        
        // Set up callbacks
        OCIVoiceNative.setOnSpeechStart(() => {
          if (this.onSpeechStart) this.onSpeechStart();
        });
        
        OCIVoiceNative.setOnSpeechEnd(() => {
          if (this.onSpeechEnd) this.onSpeechEnd();
        });
        
        OCIVoiceNative.setOnSpeechResults((result) => {
          if (this.onSpeechResults) this.onSpeechResults(result);
        });
        
        OCIVoiceNative.setOnSpeechPartialResults((result) => {
          if (this.onSpeechPartialResults) this.onSpeechPartialResults(result);
        });
        
        OCIVoiceNative.setOnSpeechError((error) => {
          if (this.onSpeechError) this.onSpeechError(error);
        });
        
        OCIVoiceNative.setOnSpeechVolumeChanged((volume) => {
          if (this.onSpeechVolumeChanged) this.onSpeechVolumeChanged(volume);
        });
        
        // Start listening using the native module
        const startResult = await OCIVoiceNative.startListening({
          token: this.sessionToken,
          compartmentId: this.compartmentId
        });
        
        if (!startResult) {
          throw new Error('Failed to start Android speech recognition');
        }
        
        this.isListening = true;
        console.log('Android speech recognition started successfully');
        return;
      }
      
      // For Web, use WebSockets
      await this.setupWebSocket();
      
      this.isListening = true;
      
      console.log('Speech recognition started successfully');
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      await this.cleanup();
      
      if (this.onSpeechError) {
        this.onSpeechError(error);
      }
      
      throw error;
    }
  }  /**
   * Stop speech recognition and clean up resources
   */
  async stopListening() {
    if (!this.isListening) {
      console.log('Not listening, ignoring stop request');
      return;
    }

    console.log('Stopping speech recognition...');
    
    try {
      this.isListening = false;
      
      // For Android, use the native module
      if (Platform.OS === 'android') {
        if (OCIVoiceNative) {
          await OCIVoiceNative.stopListening();
        }
      } else {
        // For Web, stop audio capture and close WebSocket
        await this.stopAudioCapture();
        this.closeWebSocket();
      }
      
      if (this.onSpeechEnd) {
        this.onSpeechEnd();
      }
      
      console.log('Speech recognition stopped successfully');
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
    } finally {
      await this.cleanup();
    }
  }
  /**
   * Restart speech recognition - stops current session and starts a new one
   * This is useful for maintaining continuous speech recognition with fresh tokens
   */
  async restartListening() {
    console.log('Restarting speech recognition...');
    
    try {
      // Stop current session if running
      if (this.isListening) {
        await this.stopListening();
      }
      
      // Force token refresh for restart - OCI real-time tokens appear to be single-use
      console.log('Forcing fresh token for restart...');
      this.sessionToken = null;
      this.sessionId = null;
      this.tokenExpiresAt = 0;
      
      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Start fresh session (this will get a new token)
      await this.startListening();
      
      console.log('Speech recognition restarted successfully');
    } catch (error) {
      console.error('Failed to restart speech recognition:', error);
      throw error;
    }
  }

  /**
   * Check if the service is currently listening
   */
  isRecognitionActive() {
    return this.isListening;
  }

  // Callback setters

  setOnSpeechStart(callback) {
    this.onSpeechStart = callback;
  }

  setOnSpeechEnd(callback) {
    this.onSpeechEnd = callback;
  }

  setOnSpeechResults(callback) {
    this.onSpeechResults = callback;
  }

  setOnSpeechPartialResults(callback) {
    this.onSpeechPartialResults = callback;
  }

  setOnSpeechError(callback) {
    this.onSpeechError = callback;
  }

  setOnSpeechVolumeChanged(callback) {
    this.onSpeechVolumeChanged = callback;
  }
}

// Export a singleton instance
export default new OCIVoiceService();
