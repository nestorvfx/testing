import React from 'react';
import { View, Text, StyleSheet, Animated, useWindowDimensions } from 'react-native';

const AnalysisStatusIndicator = ({ analysisSession, analysisInProgress }) => {
  // Use session data instead of direct counts
  const { active, analyzedImagesInSession, totalImagesInSession } = analysisSession;
  
  // Get window dimensions to calculate constraints
  const { width, height } = useWindowDimensions();
  
  // Calculate max width based on 70% of width and 50% of height
  const maxWidth = Math.min(width * 0.7, height * 0.5);
  
  // Calculate completion percentage based on session data
  const completionPercentage = totalImagesInSession > 0 
    ? Math.round((analyzedImagesInSession / totalImagesInSession) * 100) 
    : 0;
  
  // Only show when session is active or analysis is in progress
  if (!active && !analysisInProgress || totalImagesInSession === 0) {
    return null;
  }
  
  // Hide when all images in the session have been analyzed and analysis is not in progress
  if (analyzedImagesInSession >= totalImagesInSession && !analysisInProgress) {
    return null;
  }
  
  return (
    <View style={styles.container}>
      <View style={[
        styles.progressContainer,
        { width: maxWidth } // Apply the calculated max width
      ]}>
        <View 
          style={[
            styles.progressBar, 
            { width: `${completionPercentage}%` }
          ]} 
        />
      </View>
      <Text style={styles.statusText}>
        Analyzed {analyzedImagesInSession}/{totalImagesInSession}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 140, // Position above the deep analysis button
    left: 20,
    right: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  progressContainer: {
    height: 4,
    // Width is now applied dynamically with the calculated maxWidth
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 5,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4285F4',
    borderRadius: 2,
  },
  statusText: {
    fontSize: 12,
    color: '#555',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
  }
});

export default AnalysisStatusIndicator;
