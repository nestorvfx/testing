import React from 'react';
import { TouchableOpacity, StyleSheet, Animated, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ImmediateAnalysisButton = ({ isActive, onToggle, isAnalyzing }) => {  // Create an animated value for pulsing effect during analysis when active
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  
  return (
    <View style={styles.wrapper}>
      <Animated.View style={[
        styles.animationContainer,
        { transform: [{ scale: isActive ? pulseAnim : 1 }] }
      ]}>
        <TouchableOpacity
          style={[
            styles.container,
            isActive ? styles.active : styles.inactive
          ]}
          onPress={onToggle}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={isActive ? "flash" : "flash-outline"} 
            size={22} 
            color={isActive ? "#fff" : "#999"} 
          />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  animationContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ scale: 1 }], // Initial scale
  },
  container: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,  },
  active: {
    backgroundColor: '#FF9800',
  },
  inactive: {
    backgroundColor: '#f0f0f0',
  },
});

export default ImmediateAnalysisButton;
