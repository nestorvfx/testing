import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

const SpeechWaveVisualizer = ({ isListening, text, volume = 0 }) => {
  const [bars, setBars] = useState([]);
  const numBars = 8; // Number of bars in the visualizer
  
  // Create animated values for each bar
  useEffect(() => {
    const newBars = Array(numBars).fill().map(() => new Animated.Value(0));
    setBars(newBars);
  }, []);

  // Animate bars based on volume
  useEffect(() => {
    if (isListening && volume > 0) {
      bars.forEach((bar, index) => {
        // Create random heights based on volume
        const randomHeight = (Math.random() * volume * 0.8) + (volume * 0.2);
        
        // Stagger the animations for a wave effect
        const delay = index * 50;
        
        Animated.sequence([
          Animated.timing(bar, {
            toValue: randomHeight / 100 * 40, // Scale to max height of 40
            duration: 300,
            useNativeDriver: false,
          }),
          Animated.timing(bar, {
            toValue: randomHeight / 100 * 20, // Decrease to create wave effect
            duration: 300,
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
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    padding: 15,
    zIndex: 999,
  },
  text: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 10,
  },
  visualizer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 40,
  },
  bar: {
    width: 4,
    backgroundColor: '#6A1B9A',
    borderRadius: 2,
  },
});

export default SpeechWaveVisualizer;
