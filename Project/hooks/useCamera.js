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
    if (!cameraReady || isCapturing || !cameraRef.current) return null;
    
    // Don't set capturing state for Android to avoid flash
    if (Platform.OS !== 'android') {
      setIsCapturing(true);
    }
    
    // Subtle button animation
    captureButtonScale.setValue(0.95);
    setTimeout(() => captureButtonScale.setValue(1), 100);
    
    try {
      let photo;
      
      if (isWeb) {
        if (!cameraRef.current?.takePictureAsync) {
          throw new Error('Web camera not ready');
        }
        photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      } else if (cameraRef.current) {
        // For Android, use options that prevent flash
        if (Platform.OS === 'android') {
          photo = await cameraRef.current.takePictureAsync({
            // Ensure flash is off
            flash: 'off',
            // Disable any processing that might cause screen flashes
            skipProcessing: true
          });
        } else {
          // For iOS, use the regular options
          photo = await cameraRef.current.takePictureAsync({
            quality: 0.8,
            exif: false,
          });
        }
        
        // Save to media library on mobile
        try {
          await MediaLibrary.saveToLibraryAsync(photo.uri);
        } catch (error) {
          console.warn('Could not save to library:', error);
        }
      } else {
        throw new Error('Camera not available');
      }
      
      // Add metadata
      const photoWithMetadata = {
        ...photo,
        timestamp: Date.now(),
        description: "Captured scene at " + new Date().toLocaleTimeString(),
        isFlipped: true,
      };
      
      // For Android, don't change capturing state to avoid UI updates
      if (Platform.OS !== 'android') {
        setIsCapturing(false);
      }
      
      return photoWithMetadata;
      
    } catch (error) {
      console.error('Error capturing photo:', error);
      setCameraError(error);
      if (Platform.OS !== 'android') {
        setIsCapturing(false);
      }
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
