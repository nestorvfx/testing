import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

const AnalysisStatusIndicator = ({ analyzedCount, totalCount, analysisInProgress }) => {
  // Calculate completion percentage
  const completionPercentage = totalCount > 0 ? Math.round((analyzedCount / totalCount) * 100) : 0;
  
  // Only show when there are images and some are analyzed (but not all)
  if (totalCount === 0 || (analyzedCount === 0 && !analysisInProgress) || (analyzedCount === totalCount && !analysisInProgress)) {
    return null;
  }
  
  return (
    <View style={styles.container}>
      <View style={styles.progressContainer}>
        <View 
          style={[
            styles.progressBar, 
            { width: `${completionPercentage}%` }
          ]} 
        />
      </View>
      <Text style={styles.statusText}>
        {analysisInProgress 
          ? `Analyzing... ${analyzedCount}/${totalCount}` 
          : `${analyzedCount}/${totalCount} analyzed`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100, // Position above the deep analysis button
    left: 20,
    right: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  progressContainer: {
    height: 4,
    width: '80%',
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
