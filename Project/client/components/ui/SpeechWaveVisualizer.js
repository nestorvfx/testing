import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';

const SpeechWaveVisualizer = ({ isListening, text, volume = 0 }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [displayText, setDisplayText] = useState('');
    // Update display text when we receive new text
  useEffect(() => {
    if (text && text.trim().length > 0) {
      setDisplayText(text);
    } else if (text === '') {
      // Clear display text immediately when parent explicitly sets empty text
      setDisplayText('');
    }
  }, [text]);
    // Handle visibility based on listening state and having text to show
  useEffect(() => {
    if (isListening && displayText) {
      // Fade in quickly for responsive feel
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else if (!isListening || !displayText) {
      // Fade out when not listening OR when display text is cleared
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: displayText ? 300 : 100, // Faster fade when text is manually cleared
        useNativeDriver: true,
      }).start(() => {
        // Clear display text only after fade out animation completes (if not already cleared)
        if (!displayText) {
          setDisplayText('');
        }
      });
    }
  }, [isListening, displayText, fadeAnim]);
  
  // Don't render anything if no text to display
  if (!displayText) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Text style={styles.text}>{displayText}</Text>
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
