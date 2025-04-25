import React from 'react';
import { TouchableOpacity, View, Animated, Platform, TouchableHighlight } from 'react-native';
import { styles } from '../../styles';

const CaptureButton = ({ onPress, isCapturing, disabled, captureButtonScale }) => {
  // On Android, use a TouchableHighlight with no animation
  if (Platform.OS === 'android') {
    return (
      <View style={{
        position: 'absolute',
        bottom: 60,
        zIndex: 999,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
      }}>
        <TouchableHighlight
          style={{
            width: 70,
            height: 70,
            borderRadius: 35,
            backgroundColor: 'rgba(255, 255, 255, 0.25)',
            justifyContent: 'center',
            alignItems: 'center',
            elevation: 5,
          }}
          onPress={onPress}
          underlayColor="transparent"  // No color change on press
          activeOpacity={1}           // No opacity change
          disabled={disabled}
        >
          <View style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: '#f44336',
            borderWidth: 3,
            borderColor: 'white',
          }} />
        </TouchableHighlight>
      </View>
    );
  }
  
  // Use standard button for non-Android platforms
  return (
    <Animated.View style={{
      transform: [{ scale: captureButtonScale }],
      position: 'absolute',
      bottom: 60,
      zIndex: 50,
      alignItems: 'center',
      justifyContent: 'center',
      width:'100%',
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
