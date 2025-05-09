import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import VoiceService from '../../services/voiceService';

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
  const [showFullLogs, setShowFullLogs] = useState(false);
  const [logLevel, setLogLevel] = useState('all'); // 'all', 'error', 'warn', 'info'
  
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
  
  // Get speech logs for display
  const speechLogs = VoiceService.speechLogs || [];
  
  // Filter logs by level if needed
  const filteredLogs = logLevel === 'all' ? 
    speechLogs : 
    speechLogs.filter(log => log.level === logLevel);
  
  // Format the time from ISO string
  const formatLogTime = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString(undefined, { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        fractionalSecondDigits: 3
      });
    } catch (e) {
      return isoString;
    }
  };
  
  // Get color for log level
  const getLogLevelColor = (level) => {
    switch (level) {
      case 'error': return '#ff5252';
      case 'warn': return '#ffc107';
      case 'debug': return '#81c784';
      default: return '#ffffff';
    }
  };
  
  const toggleLogLevel = () => {
    const levels = ['all', 'error', 'warn', 'info', 'debug'];
    const currentIndex = levels.indexOf(logLevel);
    const nextIndex = (currentIndex + 1) % levels.length;
    setLogLevel(levels[nextIndex]);
  };

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
        
        <View style={styles.logsHeaderContainer}>
          <TouchableOpacity onPress={() => setShowFullLogs(!showFullLogs)}>
            <Text style={styles.logsHeaderText}>
              Speech Logs {showFullLogs ? '(Hide)' : '(Show)'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={toggleLogLevel} style={styles.logLevelButton}>
            <Text style={styles.logLevelText}>
              Level: {logLevel.toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
        
        {showFullLogs && (
          <ScrollView style={styles.logsContainer}>
            {filteredLogs.length === 0 ? (
              <Text style={styles.noLogsText}>No logs available</Text>
            ) : (
              filteredLogs.slice(0, 50).map((log, index) => (
                <View key={index} style={styles.logEntry}>
                  <Text style={[styles.logTime, { color: getLogLevelColor(log.level) }]}>
                    {formatLogTime(log.timestamp)} [{log.level.toUpperCase()}]
                  </Text>
                  <Text style={[styles.logMessage, { color: getLogLevelColor(log.level) }]}>
                    {log.message}
                  </Text>
                  {log.data && (
                    <Text style={styles.logData}>
                      {log.data}
                    </Text>
                  )}
                </View>
              ))
            )}
          </ScrollView>
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
    maxHeight: '80%',
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
  },
  logsHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    paddingTop: 8,
  },
  logsHeaderText: {
    color: '#4fc3f7',
    fontSize: 14,
    fontWeight: 'bold',
  },
  logLevelButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  logLevelText: {
    color: '#fff',
    fontSize: 12,
  },
  logsContainer: {
    maxHeight: 300,
    marginTop: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 4,
    padding: 8,
  },
  noLogsText: {
    color: '#aaa',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 10,
  },
  logEntry: {
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingBottom: 4,
  },
  logTime: {
    color: '#ddd',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  logMessage: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  logData: {
    color: '#bbb',
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 2,
    paddingLeft: 10,
  }
});

export default VoiceDebugOverlay;
