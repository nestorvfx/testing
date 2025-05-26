import { useState, useEffect } from 'react';
import { Camera } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';
import { isWeb } from '../constants';

export const usePermissions = () => {
  // Set hasPermission to 'pending' instead of null to avoid showing permission screen
  const [hasPermission, setHasPermission] = useState('pending');
  const [mediaPermissionOnly, setMediaPermissionOnly] = useState(false);
  const [permissionError, setPermissionError] = useState(null);
  const [isMounted, setIsMounted] = useState(true);

  // Function to request media permission for mobile
  const requestMediaPermissionOnly = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (isMounted) {
        if (status === 'granted') {
          setHasPermission(true);
          setMediaPermissionOnly(false);
        } else {
          setHasPermission(false);
          setPermissionError(new Error(
            `Media library permission not granted: ${status}`
          ));
        }
      }
    } catch (error) {
      if (isMounted) {
        setPermissionError(error);
        setHasPermission(false);
      }
    }
  };

  // Function to retry permission requests
  const retryPermissions = () => {
    setHasPermission('pending');
    setMediaPermissionOnly(false);
    setPermissionError(null);
  };

  // Request necessary permissions on mount
  useEffect(() => {
    setIsMounted(true);
    
    const getPermissions = async () => {
      try {
        // For web platform, we only need camera permission, not media library
        if (isWeb) {
          const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
          
          if (isMounted) {
            setHasPermission(cameraStatus === 'granted');
            if (cameraStatus !== 'granted') {
              setPermissionError(new Error(`Camera permission not granted: ${cameraStatus}`));
            }
          }
          return;
        }
        
        // Mobile platforms need both camera and media library permissions
        // Check existing permissions first
        const cameraPermissionInfo = await Camera.getCameraPermissionsAsync();
        const mediaLibraryPermissionInfo = await MediaLibrary.getPermissionsAsync();
        
        // If both permissions are already granted, set state immediately
        if (cameraPermissionInfo.status === 'granted' && mediaLibraryPermissionInfo.status === 'granted') {
          if (isMounted) {
            setHasPermission(true);
            setMediaPermissionOnly(false);
            return;
          }
        }

        // Special case: Camera granted but media undetermined - focus on requesting media permission
        if (cameraPermissionInfo.status === 'granted' && mediaLibraryPermissionInfo.status === 'undetermined') {
          setMediaPermissionOnly(true);
          await requestMediaPermissionOnly();
          return;
        }
        
        // Request camera permissions if not already granted
        const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
        
        // Request media library permissions if not already granted
        const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
        
        if (isMounted) {
          const permissionsGranted = cameraStatus === 'granted' && mediaStatus === 'granted';
          setHasPermission(permissionsGranted);
          
          // If permissions were denied, set an error message
          if (!permissionsGranted) {
            setPermissionError(new Error(
              `Permissions not granted. Camera: ${cameraStatus}, Media: ${mediaStatus}`
            ));
          }
        }
      } catch (error) {
        console.error('Error requesting permissions:', error);
        if (isMounted) {
          setPermissionError(error);
          setHasPermission(false);
        }
      }
    };

    // Start permission check immediately
    getPermissions();
    
    return () => {
      setIsMounted(false);
    };
  }, []);
  
  return {
    // For Android always return true initially to avoid the permission screen flash
    hasPermission: Platform.OS === 'android' ? (hasPermission === 'pending' ? true : hasPermission) : hasPermission,
    mediaPermissionOnly,
    permissionError,
    requestMediaPermissionOnly,
    retryPermissions
  };
};
