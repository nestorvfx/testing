import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

const SpeechWaveVisualizer = ({ isListening, text, volume = 0 }) => {
  const [bars, setBars] = useState([]);
  const numBars = 16; // More bars for a fuller visualization
  
  // Create animated values for each bar
  useEffect(() => {
    const newBars = Array(numBars).fill().map(() => new Animated.Value(0));
    setBars(newBars);
  }, []);

  // Animate bars based on volume
  useEffect(() => {
    if (isListening && volume > 0) {
      bars.forEach((bar, index) => {
        // Create a wave-like pattern with center bars higher than edge bars
        const distanceFromCenter = Math.abs(index - numBars/2 + 0.5);
        const centerFactor = 1 - (distanceFromCenter / (numBars/2)) * 0.5;
        
        // Random variation for more natural movement
        const randomFactor = 0.7 + Math.random() * 0.6;
        
        // Combine factors for final height
        const heightFactor = volume * centerFactor * randomFactor;
        
        // Stagger the animations for a wave effect
        const delay = index * 25;
        
        Animated.sequence([
          Animated.timing(bar, {
            toValue: heightFactor / 10 * 55, // Scale by max height
            duration: 200 + Math.random() * 100, // Randomize duration slightly
            useNativeDriver: false,
          }),
          Animated.timing(bar, {
            toValue: heightFactor / 10 * 30, // Decrease to create wave effect
            duration: 200 + Math.random() * 100,
            useNativeDriver: false,
          })
        ]).start();
      });
    } else if (!isListening) {
      // Reset bars when not listening
      bars.forEach(bar => {
        Animated.timing(bar, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }).start();
      });
    }
  }, [isListening, volume, bars]);

  if (!isListening || !text) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{text}</Text>
      <View style={styles.visualizer}>
        {bars.map((bar, index) => (
          <Animated.View
            key={index}              
            style={[
              styles.bar,
              {
                height: bar,
                backgroundColor: `hsl(${180 + (index * 4)}, 75%, 60%)`, // Smoother color gradient
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '30%', // Position higher in the view for better visibility
    left: 30,
    right: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.95)', // More opaque for better readability
    borderRadius: 24,
    padding: 20, // More padding for a more spacious look
    zIndex: 999,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 5, // Stronger shadow
    },
    shadowOpacity: 0.25,
    shadowRadius: 6, // Larger shadow radius for a softer shadow
    elevation: 8, // Higher elevation on Android
    borderWidth: 1,
    borderColor: 'rgba(200, 200, 220, 0.7)', // Slight blue tint to the border
  },
  text: {
    color: '#334', // Slightly more blue-tinted text
    fontSize: 24, // Larger font
    fontWeight: '600', // Slightly bolder
    marginBottom: 16, // More space between text and visualizer
    textAlign: 'center',
    letterSpacing: 0.3, // Slightly more letter spacing
    lineHeight: 32, // Better line height for readability
  },  
  visualizer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    height: 50, // Taller visualizer
    width: '90%', // Wider to fill more space
    marginTop: 4, // Additional space at top
    marginBottom: 8, // Additional space at bottom
  },
  bar: {
    width: 5, // Slightly wider bars
    marginHorizontal: 3, // More space between bars
    borderRadius: 6, // Rounder bars
    opacity: 0.9, // More opaque for better visibility
  },
});

export default SpeechWaveVisualizer;
