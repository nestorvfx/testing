import React from 'react';
import { View, Text, StatusBar } from 'react-native';
import { Camera } from 'expo-camera';
import WebCamera from './WebCamera';
import { styles } from '../../styles';
import { isWeb, CAMERA_TYPE } from '../../constants';

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

  // Camera props - change to horizontal flip (scaleX instead of scaleY)
  const cameraProps = {
    style: [
      cameraStyle,
      { transform: [{ scaleX: -1 }] } // Flip camera horizontally
    ],
    onCameraReady: () => {
      console.log('Camera is ready');
      setCameraReady(true);
    },
    onMountError: (error) => {
      console.error('Camera mount error:', error);
      setCameraError(error);
    }
  };

  // Only add ref to native Camera component, not to WebCamera
  if (!isWeb) {
    cameraProps.ref = cameraRef;
  }

  // Add platform-specific props
  if (!isWeb) {
    // Native platforms - explicitly use front camera
    if (Camera.Constants && Camera.Constants.Type) {
      cameraProps.type = Camera.Constants.Type.front;
    }
    cameraProps.ratio = "16:9";
  }

  try {
    // On web, we'll use our custom WebCamera component
    const CameraComponent = isWeb ? WebCamera : Camera;
    
    // Set up the appropriate ref based on platform
    if (isWeb) {
      cameraRef.current = WebCamera;
    }

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
          
          {/* Capturing indicator */}
          {isCapturing && (
            <View style={styles.recordingIndicator}>
              <Text style={styles.recordingText}>Capturing</Text>
            </View>
          )}
          
          {/* Display camera initialization message */}
          {!cameraReady && (
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
      <View style={[styles.errorContainer, {position: 'relative', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#000'}]}>
        <Text style={styles.errorText}>
          Camera Error: {error.message || 'Failed to render camera component'}
        </Text>
      </View>
    );
  }
};

export default CameraView;
