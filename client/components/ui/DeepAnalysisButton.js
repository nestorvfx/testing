import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Dimensions, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DeepAnalysisButton = ({ onPress, isAnalyzing, hasDeepAnalysis, analyzedCount, totalCount }) => {
  // Get screen width to determine button layout
  const screenWidth = Dimensions.get('window').width;
  const isSmallScreen = screenWidth < 400;
  
  // Calculate progress for the button label
  const progressText = totalCount > 0 ? `${analyzedCount}/${totalCount}` : '';
  const showProgress = totalCount > 0 && analyzedCount > 0;
  
  return (    <TouchableOpacity
      style={[
        styles.container,
        hasDeepAnalysis ? styles.hasResultsContainer : null,
        isSmallScreen ? styles.smallScreenContainer : null,
        // Add Android-specific styles
        Platform.OS === 'android' ? styles.androidContainer : null
      ]}
      onPress={onPress}
      // Add hitSlop to increase touch area, especially important for Android
      hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
      activeOpacity={0.7}
      disabled={isAnalyzing && !hasDeepAnalysis}
    >
      {isAnalyzing && !hasDeepAnalysis ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <>
          <Ionicons 
            name={hasDeepAnalysis ? "document-text" : "analytics"} 
            size={20} 
            color="#fff" 
          />
          {isSmallScreen ? (
            // Two-line text for small screens
            <View style={styles.twoLineTextContainer}>
              <Text style={[styles.text, styles.smallText]}>
                {hasDeepAnalysis ? "View" : "Deep"}
              </Text>
              <Text style={[styles.text, styles.smallText]}>
                {hasDeepAnalysis ? "Analysis" : "Analysis"}
              </Text>
            </View>
          ) : (
            // Single line for larger screens
            <Text style={styles.text}>
              {hasDeepAnalysis ? "View Analysis" : "Deep Analysis"}
            </Text>
          )}
        </>
      )}
      
      {/* For Android only: add a completely transparent overlay with higher elevation for better touch */}
      {Platform.OS === 'android' && (
        <View 
          style={styles.androidTouchHelper}
          pointerEvents="none"
        />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 55,
    right: 20,
    backgroundColor: '#8E44AD',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
    zIndex: 100,
  },
  smallScreenContainer: {
    // Move closer to the edge on small screens
    right: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  hasResultsContainer: {
    backgroundColor: '#27AE60',
  },
  text: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 8,
  },
  smallText: {
    fontSize: 12,
    marginLeft: 5,
    lineHeight: 14,
  },
  twoLineTextContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    marginLeft: 4,
  },
  androidContainer: {
    // Enhance Android-specific styles
    elevation: 1,
    zIndex: 3000, // Higher zIndex on Android
    bottom: 50, // Adjust position slightly
    paddingVertical: 12, // Slightly larger for easier tapping
  },
  androidTouchHelper: {
    position: 'absolute',
    top: -15,
    left: -15,
    right: -15,
    bottom: -15,
    backgroundColor: 'transparent',
    elevation: 10, // Higher elevation to catch touches
  }
});

export default DeepAnalysisButton;
