import { useState, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { convertFloat32ToInt16, createAudioContext, requestMicrophoneAccess } from '../utils/audioUtils';
import { getServerUrlWithOverride } from '../config/serverConfig';

interface SpeechRecognitionResult {
  transcription: string;
  isFinal: boolean;
  confidence?: number;
}

interface SpeechRecognitionHook {
  isConnected: boolean;
  isRecording: boolean;
  transcript: string;
  partialTranscript: string;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  clearTranscript: () => void;
}

interface TokenResponse {
  token: string;
  sessionId: string;
  compartmentId: string;
}

export function useSpeechRecognition(serverUrl?: string): SpeechRecognitionHook {
  // Use provided serverUrl or get from configuration
  const effectiveServerUrl = serverUrl || getServerUrlWithOverride();
  
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const websocketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  /**
   * Fetch authentication token from server
   */
  const fetchAuthToken = async (): Promise<TokenResponse> => {
    const response = await fetch(`${effectiveServerUrl}/authenticate`);
    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status}`);
    }
    return await response.json();
  };

  /**
   * Fetch region from server
   */
  const fetchRegion = async (): Promise<string> => {
    const response = await fetch(`${effectiveServerUrl}/region`);
    if (!response.ok) {
      throw new Error(`Failed to fetch region: ${response.status}`);
    }
    const data = await response.json();
    return data.region;
  };

  /**
   * Create WebSocket connection with OCI Speech service
   */
  const createWebSocketConnection = useCallback(async (tokenData: TokenResponse, region: string) => {
    // Build WebSocket URL with query parameters
    const baseUrl = `wss://realtime.aiservice.${region}.oci.oraclecloud.com/ws/transcribe/stream`;
    const params = new URLSearchParams({
      'isAckEnabled': 'false',
      'partialSilenceThresholdInMs': '0',
      'finalSilenceThresholdInMs': '1000',
      'stabilizePartialResults': 'NONE',
      'shouldIgnoreInvalidCustomizations': 'false',
      'languageCode': 'en-US',
      'modelDomain': 'GENERIC',
      'punctuation': 'NONE',
      'encoding': 'audio/raw;rate=16000'
    });

    const websocketUrl = `${baseUrl}?${params.toString()}`;
    console.log('Connecting to:', websocketUrl);

    const ws = new WebSocket(websocketUrl);

    return new Promise<WebSocket>((resolve, reject) => {      ws.onopen = () => {
        console.log('WebSocket connected, sending authentication...');
        
        // Send authentication message
        const authMessage = {
          authenticationType: "TOKEN",
          compartmentId: tokenData.compartmentId,
          token: tokenData.token
        };
        
        ws.send(JSON.stringify(authMessage));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('Received message:', message);

          if (message.event === "CONNECT") {
            console.log('Authentication successful');
            setIsConnected(true);
            setError(null);
            resolve(ws);
          } else if (message.event === "RESULT") {
            handleTranscriptionResult(message);
          } else if (message.event === "ERROR") {
            console.error('Speech service error:', message);
            setError(`Speech service error: ${message.message || 'Unknown error'}`);
            reject(new Error(message.message || 'Speech service error'));
          }
        } catch (err) {
          console.error('Error parsing message:', err);
          setError('Error parsing server response');
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('WebSocket connection error');
        reject(error);
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        setIsRecording(false);
        if (event.code !== 1000) { // Not a normal closure
          setError(`Connection closed: ${event.code} ${event.reason || ''}`);
        }
      };
    });
  }, []);

  /**
   * Handle transcription results from the service
   */
  const handleTranscriptionResult = (message: any) => {
    const transcriptions = message.transcriptions;
    if (transcriptions && transcriptions.length > 0) {
      const result = transcriptions[0];
      
      if (result.isFinal) {
        console.log('Final result:', result.transcription);
        setTranscript(prev => prev + (prev ? ' ' : '') + result.transcription);
        setPartialTranscript('');
      } else {
        console.log('Partial result:', result.transcription);
        setPartialTranscript(result.transcription);
      }
    }
  };

  /**
   * Setup audio capture and processing
   */
  const setupAudioCapture = async (websocket: WebSocket) => {
    try {
      // Only setup audio capture for web platform
      if (Platform.OS !== 'web') {
        console.log('Audio capture not supported on this platform');
        return;
      }

      // Request microphone access
      const stream = await requestMicrophoneAccess();
      streamRef.current = stream;

      // Create audio context
      audioContextRef.current = createAudioContext();
      const audioContext = audioContextRef.current;

      // Create microphone source
      microphoneRef.current = audioContext.createMediaStreamSource(stream);
      const microphone = microphoneRef.current;

      // Create audio processor
      processorRef.current = audioContext.createScriptProcessor(4096, 1, 1);
      const processor = processorRef.current;

      // Process audio data
      processor.onaudioprocess = (event) => {
        if (websocket.readyState === WebSocket.OPEN) {
          const inputBuffer = event.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);
          
          // Convert to 16-bit PCM and send to WebSocket
          const pcmData = convertFloat32ToInt16(inputData);
          websocket.send(pcmData.buffer);
        }
      };

      // Connect audio nodes
      microphone.connect(processor);
      processor.connect(audioContext.destination);

      setIsRecording(true);
      console.log('Audio capture started');
    } catch (err) {
      console.error('Error setting up audio capture:', err);
      setError('Failed to access microphone');
      throw err;
    }
  };

  /**
   * Start speech recognition
   */
  const startRecording = async () => {
    try {
      setError(null);
      console.log('Starting speech recognition...');

      // Fetch authentication and region
      const [tokenData, region] = await Promise.all([
        fetchAuthToken(),
        fetchRegion()
      ]);

      console.log('Token and region fetched:', { sessionId: tokenData.sessionId, region });

      // Create WebSocket connection
      const websocket = await createWebSocketConnection(tokenData, region);
      websocketRef.current = websocket;

      // Setup audio capture (only for web)
      if (Platform.OS === 'web') {
        await setupAudioCapture(websocket);
      } else {
        // For React Native, just mark as recording
        setIsRecording(true);
        console.log('Native audio capture would be handled by native modules');
      }

    } catch (err) {
      console.error('Error starting recording:', err);
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      setIsConnected(false);
      setIsRecording(false);
    }
  };

  /**
   * Stop speech recognition
   */
  const stopRecording = () => {
    console.log('Stopping speech recognition...');

    // Close WebSocket
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }

    // Stop audio processing
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (microphoneRef.current) {
      microphoneRef.current.disconnect();
      microphoneRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsConnected(false);
    setIsRecording(false);
    setPartialTranscript('');
  };

  /**
   * Clear transcript
   */
  const clearTranscript = () => {
    setTranscript('');
    setPartialTranscript('');
  };

  return {
    isConnected,
    isRecording,
    transcript,
    partialTranscript,
    error,
    startRecording,
    stopRecording,
    clearTranscript
  };
}
