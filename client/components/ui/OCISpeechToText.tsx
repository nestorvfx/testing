import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';

interface OCISpeechToTextProps {
  serverUrl?: string;
  onTranscriptChange?: (transcript: string) => void;
  style?: any;
}

export const OCISpeechToText: React.FC<OCISpeechToTextProps> = ({ 
  serverUrl = 'http://localhost:8448',
  onTranscriptChange,
  style
}) => {
  const {
    isConnected,
    isRecording,
    transcript,
    partialTranscript,
    error,
    startRecording,
    stopRecording,
    clearTranscript
  } = useSpeechRecognition(serverUrl);

  React.useEffect(() => {
    if (onTranscriptChange) {
      onTranscriptChange(transcript);
    }
  }, [transcript, onTranscriptChange]);

  const getRecordingButtonStyle = () => {
    if (isRecording) {
      return [styles.button, styles.stopButton];
    } else {
      return [styles.button, styles.startButton];
    }
  };

  const getConnectionStatusColor = () => {
    return isConnected ? '#28a745' : '#dc3545';
  };

  const getRecordingStatusColor = () => {
    return isRecording ? '#007cba' : '#6c757d';
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>Oracle Cloud Speech-to-Text</Text>
      
      {/* Control Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={startRecording}
          disabled={isRecording}
          style={getRecordingButtonStyle()}
        >
          <Text style={styles.buttonText}>
            {isRecording ? 'Recording...' : 'Start Recording'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={stopRecording}
          disabled={!isRecording}
          style={[
            styles.button, 
            isRecording ? styles.stopButton : styles.disabledButton
          ]}
        >
          <Text style={styles.buttonText}>Stop Recording</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={clearTranscript}
          style={[styles.button, styles.clearButton]}
        >
          <Text style={styles.buttonText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Status Indicators */}
      <View style={styles.statusContainer}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Connection:</Text>
          <View style={[
            styles.statusIndicator, 
            { backgroundColor: getConnectionStatusColor() }
          ]}>
            <Text style={styles.statusText}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </Text>
          </View>
        </View>
        
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Recording:</Text>
          <View style={[
            styles.statusIndicator, 
            { backgroundColor: getRecordingStatusColor() }
          ]}>
            <Text style={styles.statusText}>
              {isRecording ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
      </View>

      {/* Error Display */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      )}

      {/* Transcript Display */}
      <View style={styles.transcriptContainer}>
        <Text style={styles.transcriptTitle}>Transcript:</Text>
        <View style={styles.transcriptContent}>
          <Text style={styles.transcriptText}>
            {transcript}
            {partialTranscript && (
              <Text style={styles.partialText}>
                {transcript ? ' ' : ''}{partialTranscript}
              </Text>
            )}
            {!transcript && !partialTranscript && (
              <Text style={styles.placeholderText}>
                Click "Start Recording" and speak to see transcription here...
              </Text>
            )}
          </Text>
        </View>
      </View>

      {/* Platform Information */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          Platform: {Platform.OS} 
          {Platform.OS === 'web' ? ' (Full audio support)' : ' (Limited audio support)'}
        </Text>
        <Text style={styles.infoText}>
          Server: {serverUrl}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    maxWidth: 800,
    alignSelf: 'center',
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 5,
    margin: 5,
    minWidth: 120,
  },
  startButton: {
    backgroundColor: '#007cba',
  },
  stopButton: {
    backgroundColor: '#dc3545',
  },
  clearButton: {
    backgroundColor: '#6c757d',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  statusContainer: {
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusLabel: {
    marginRight: 10,
    fontWeight: 'bold',
    minWidth: 80,
  },
  statusIndicator: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
  },
  errorText: {
    color: '#721c24',
    fontWeight: 'bold',
  },
  transcriptContainer: {
    marginBottom: 20,
  },
  transcriptTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  transcriptContent: {
    minHeight: 200,
    padding: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    backgroundColor: '#f9f9f9',
  },
  transcriptText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  partialText: {
    fontStyle: 'italic',
    color: '#666',
  },
  placeholderText: {
    color: '#999',
    fontStyle: 'italic',
  },
  infoContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#e9ecef',
    borderRadius: 5,
  },
  infoText: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 5,
  },
});
