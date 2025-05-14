import React from 'react';
import { TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ImmediateAnalysisButton = ({ isActive, onToggle, isAnalyzing }) => {
  // Create an animated value for pulsing effect during analysis
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  
  React.useEffect(() => {
    if (isAnalyzing) {
      // Create pulsing animation when analyzing
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      // Reset animation when not analyzing
      pulseAnim.setValue(1);
    }
    
    return () => {
      pulseAnim.stopAnimation();
    };
  }, [isAnalyzing, pulseAnim]);
  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <TouchableOpacity
        style={[
          styles.container,
          isActive ? styles.active : styles.inactive,
          isAnalyzing && styles.analyzing
        ]}
        onPress={onToggle}
        activeOpacity={0.7}
        // Allow toggling even during analysis
      >
        <Ionicons 
          name={isActive ? "flash" : "flash-outline"} 
          size={22} 
          color={isActive ? "#fff" : "#999"} 
        />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  active: {
    backgroundColor: '#FF9800',
  },
  inactive: {
    backgroundColor: '#f0f0f0',
  },
  analyzing: {
    backgroundColor: '#4CAF50',
  },
});

export default ImmediateAnalysisButton;
