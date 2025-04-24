import React from 'react';
import { TouchableOpacity, View, Animated } from 'react-native';
import { styles } from '../../styles';

const CaptureButton = ({ onPress, isCapturing, disabled, captureButtonScale }) => {
  return (
    <Animated.View style={{
      transform: [{ scale: captureButtonScale }],
      position: 'absolute',
      bottom: 30,
      right: 30,
      zIndex: 50,
    }}>
      <TouchableOpacity 
        style={styles.captureButton} 
        onPress={onPress}
        activeOpacity={0.7}
        disabled={disabled || isCapturing}
      >
        <View style={styles.captureButtonInner}>
          {isCapturing && (
            <View style={styles.capturingIndicator} />
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default CaptureButton;
