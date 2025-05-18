import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';

const SpeechWaveVisualizer = ({ isListening, text, volume = 0 }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // Update fade animation whenever text changes
  useEffect(() => {
    if (isListening && text) {
      // Fade in quickly for responsive feel
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      // Fade out when not listening or no text
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isListening, text, fadeAnim]);
  
  // Don't render anything if not listening or no text
  if (!isListening || !text) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Text style={styles.text}>{text}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '45%', // Adjusted to be more centered vertically
    left: 0,
    right: 0,
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
      },
      android: {
        // Android has its own shadow properties
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
      },
      web: {
        textShadow: '1px 1px 2px rgba(0, 0, 0, 0.5)',
      }
    }),
  },
});

export default SpeechWaveVisualizer;
