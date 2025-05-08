import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const VoiceDebugOverlay = ({ 
  isVisible,
  isListening, 
  speechText, 
  volume, 
  errorMessage, 
  state,
  isActive,
  inCooldown,
  isAnalyzing
}) => {
  if (!isVisible) return null;

  // Get human-readable state
  const getStateText = () => {
    if (!isActive) return "INACTIVE";
    if (isAnalyzing) return "ANALYZING";
    if (inCooldown) return "COOLDOWN";
    if (isListening) {
      if (speechText) return "LISTENING (Speech Detected)";
      return "LISTENING (No Speech)";
    }
    return "ACTIVE (Not Listening)";
  };

  // Format the timestamp
  const formattedTime = new Date().toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        <Text style={styles.headerText}>Voice Debug ({formattedTime})</Text>
        
        <View style={styles.stateContainer}>
          <Text style={styles.stateLabel}>State:</Text>
          <Text style={[
            styles.stateValue, 
            isListening ? styles.listeningState : 
            inCooldown ? styles.cooldownState : 
            isAnalyzing ? styles.analyzingState : 
            isActive ? styles.activeState : styles.inactiveState
          ]}>
            {getStateText()}
          </Text>
        </View>
        
        {isListening && (
          <View style={styles.volumeContainer}>
            <Text style={styles.volumeLabel}>Volume:</Text>
            <View style={styles.volumeBarContainer}>
              <View 
                style={[
                  styles.volumeBar, 
                  { width: `${volume}%` }
                ]} 
              />
            </View>
            <Text style={styles.volumeValue}>{volume.toFixed(0)}%</Text>
          </View>
        )}
        
        <View style={styles.speechContainer}>
          <Text style={styles.speechLabel}>Speech Text:</Text>
          <Text style={styles.speechText}>
            {speechText || "(No speech detected)"}
          </Text>
        </View>
        
        {errorMessage && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorLabel}>Last Error:</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}
        
        {state && Object.keys(state).length > 0 && (
          <View style={styles.stateDetailsContainer}>
            <Text style={styles.stateDetailsLabel}>State Details:</Text>
            {Object.entries(state).map(([key, value]) => (
              <Text key={key} style={styles.stateDetailsText}>
                {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 80,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 8,
    zIndex: 9999,
  },
  contentContainer: {
    padding: 12,
  },
  headerText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  stateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stateLabel: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 8,
  },
  stateValue: {
    fontSize: 14,
    fontWeight: 'bold',
    padding: 4,
    borderRadius: 4,
  },
  inactiveState: {
    backgroundColor: '#ccc',
    color: '#333',
  },
  activeState: {
    backgroundColor: '#6A1B9A',
    color: 'white',
  },
  listeningState: {
    backgroundColor: '#e91e63',
    color: 'white',
  },
  cooldownState: {
    backgroundColor: '#9C27B0',
    color: 'white',
  },
  analyzingState: {
    backgroundColor: '#FF9800',
    color: 'white',
  },
  volumeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  volumeLabel: {
    color: 'white',
    fontSize: 14,
    marginRight: 8,
  },
  volumeBarContainer: {
    flex: 1,
    height: 10,
    backgroundColor: '#444',
    borderRadius: 5,
    overflow: 'hidden',
  },
  volumeBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  volumeValue: {
    color: 'white',
    fontSize: 14,
    marginLeft: 8,
    width: 40,
    textAlign: 'right',
  },
  speechContainer: {
    marginBottom: 8,
  },
  speechLabel: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  speechText: {
    color: '#fff',
    fontSize: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 8,
    borderRadius: 4,
    minHeight: 40,
  },
  errorContainer: {
    marginBottom: 8,
  },
  errorLabel: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 14,
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    padding: 8,
    borderRadius: 4,
  },
  stateDetailsContainer: {
    marginTop: 8,
  },
  stateDetailsLabel: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  stateDetailsText: {
    color: '#ddd',
    fontSize: 12,
    fontFamily: 'monospace',
  }
});

export default VoiceDebugOverlay;
