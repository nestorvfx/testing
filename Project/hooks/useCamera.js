import { useState, useRef } from 'react';
import { Animated, Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { isWeb } from '../constants';

export const useCamera = () => {
  const [cameraReady, setCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const cameraRef = useRef(null);
  
  // Animation for the capture button
  const captureButtonScale = useRef(new Animated.Value(1)).current;
  
  // Handle photo capture
  const capturePhoto = async () => {
    try {
      if (!cameraRef.current) {
        console.log('Camera reference is null, cannot capture photo');
        return null;
      }
      
      console.log('Taking picture with camera...');
      
      // Use a simpler approach to capture - reduce options to improve reliability
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: Platform.OS === 'android',
        fixOrientation: true
      });
      
      if (!photo) {
        console.log('takePictureAsync returned null or undefined');
        return null;
      }
      
      console.log(`Photo captured successfully: ${photo.uri}`);
      return {
        ...photo,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error in capturePhoto:', error);
      return null;
    }
  };
  
  return {
    cameraReady,
    setCameraReady,
    isCapturing,
    cameraError,
    setCameraError,
    cameraRef,
    captureButtonScale,
    capturePhoto
  };
};
