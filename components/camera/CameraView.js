import React from 'react';
import { View, Text, StatusBar, Platform } from 'react-native';
import { CameraView as ExpoCameraView } from 'expo-camera';
import WebCamera from './WebCamera';
import { styles } from '../../styles';
import { isWeb } from '../../constants';

const CameraView = ({ 
  dimensions, 
  cameraReady, 
  setCameraReady, 
  setCameraError, 
  cameraRef,
  isCapturing
}) => {
  // Calculate sizes for the camera view
  const squareSize = Math.min(dimensions.width, dimensions.height);
  const cameraStyle = {
    ...styles.camera,
    width: dimensions.width,
    height: dimensions.height,
  };

  // Calculate the position for the capture guide to center it properly
  const guideSize = squareSize * 0.8;
  const guidePosition = {
    top: (dimensions.height - guideSize) / 2,
    left: (dimensions.width - guideSize) / 2,
  };

  // Camera props - horizontal flip with scaleX
  const cameraProps = {
    style: [
      cameraStyle,
      // Only apply horizontal flip on web - can cause issues on Android
      isWeb ? { transform: [{ scaleX: -1 }] } : {}
    ],
    onCameraReady: () => {
      console.log('Camera is ready');
      setCameraReady(true);
    },
    onMountError: (error) => {
      console.error('Camera mount error:', error);
      setCameraError(error);
    },
    ref: cameraRef,
  };

  // Add platform-specific props
  if (!isWeb) {
    // For Android/iOS: Use correct props for the CameraView component
    cameraProps.device = "front";
    
    // Add error handler
    cameraProps.onError = (error) => {
      setCameraError(error);
    };
  }

  try {
    // Select the appropriate component based on platform
    const CameraComponent = isWeb ? WebCamera : ExpoCameraView;

    return (
      <CameraComponent {...cameraProps}>
        <View style={[styles.overlay, { transform: [{ scaleX: -1 }] }]}>
          {/* Capture guide / crosshair to show the square center area */}
          <View 
            style={[ 
              styles.captureGuide, 
              { 
                width: guideSize, 
                height: guideSize,
                top: guidePosition.top,
                left: guidePosition.left,
              }
            ]} 
          />
          
          {/* Only show initialization message, remove all capturing indicators */}
          {!cameraReady && Platform.OS !== 'android' && (
            <View style={styles.initializing}>
              <Text style={styles.initializingText}>Initializing camera...</Text>
            </View>
          )}
        </View>
        <StatusBar style="auto" />
      </CameraComponent>
    );
  } catch (error) {
    console.error('Error rendering camera:', error);
    return (
      <View style={[styles.errorContainer, { position: 'relative', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }]}>
        <Text style={styles.errorText}>
          Camera Error: {error.message || 'Failed to render camera component'}
        </Text>
      </View>
    );
  }
};

export default CameraView;