import { useState, useRef } from 'react';
import { Animated, Easing, Platform } from 'react-native';
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
    if (!cameraReady || isCapturing) return null;
    
    setIsCapturing(true);
    
    // Animate button press
    Animated.sequence([
      Animated.timing(captureButtonScale, {
        toValue: 0.9,
        duration: 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(captureButtonScale, {
        toValue: 1,
        duration: 200,
        easing: Easing.elastic(1.5),
        useNativeDriver: true,
      })
    ]).start();
    
    try {
      let photo;
      
      if (isWeb) {
        if (!cameraRef.current?.takePictureAsync) {
          throw new Error('Web camera not ready');
        }
        photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
        
        // For web, we need to handle the flipping ourselves since we can't modify the canvas directly
        // The WebCamera takePictureAsync already draws from the video which has the flip applied
      } else if (cameraRef.current) {
        // Add a small delay to avoid touch event issues
        await new Promise(resolve => setTimeout(resolve, 100));
        photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          skipProcessing: Platform.OS === 'android',
          exif: false,
        });
        
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
        isFlipped: true, // Mark this photo as already flipped
      };
      
      setIsCapturing(false);
      return photoWithMetadata;
      
    } catch (error) {
      console.error('Error capturing photo:', error);
      setCameraError(error);
      setIsCapturing(false);
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
