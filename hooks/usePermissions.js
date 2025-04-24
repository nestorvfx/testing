import { useState, useEffect } from 'react';
import { Camera } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { isWeb } from '../constants';

export const usePermissions = () => {
  const [hasPermission, setHasPermission] = useState(null);
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
    setHasPermission(null);
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
          console.log('Running on web platform - only checking camera permission');
          const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
          console.log('Camera permission status on web:', cameraStatus);
          
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
        
        console.log('Existing camera permission:', cameraPermissionInfo);
        console.log('Existing media library permission:', mediaLibraryPermissionInfo);
        
        // If both permissions are already granted, set state immediately
        if (cameraPermissionInfo.status === 'granted' && mediaLibraryPermissionInfo.status === 'granted') {
          if (isMounted) {
            console.log('Both permissions are already granted, setting hasPermission to true');
            setHasPermission(true);
            setMediaPermissionOnly(false);
            return;
          }
        }

        // Special case: Camera granted but media undetermined - focus on requesting media permission
        if (cameraPermissionInfo.status === 'granted' && mediaLibraryPermissionInfo.status === 'undetermined') {
          console.log('Camera permission granted, but media permission undetermined. Focusing on media permission.');
          setMediaPermissionOnly(true);
          
          // Try explicitly requesting media library permission
          await requestMediaPermissionOnly();
          return;
        }
        
        // Request camera permissions if not already granted
        const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
        console.log('Camera permission status after request:', cameraStatus);
        
        // Request media library permissions if not already granted
        const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
        console.log('Media library permission status after request:', mediaStatus);
        
        if (isMounted) {
          const permissionsGranted = cameraStatus === 'granted' && mediaStatus === 'granted';
          console.log('Setting hasPermission to:', permissionsGranted);
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

    getPermissions();
    
    // Add a permission refresh mechanism
    const permissionCheckInterval = setInterval(async () => {
      if (!hasPermission && isMounted) {
        console.log('Checking permissions again...');
        getPermissions();
      } else {
        clearInterval(permissionCheckInterval);
      }
    }, 2000);  // Check every 2 seconds if permissions were not initially granted
    
    return () => {
      setIsMounted(false);
      clearInterval(permissionCheckInterval);
    };
  }, [hasPermission]);
  
  return {
    hasPermission,
    mediaPermissionOnly,
    permissionError,
    requestMediaPermissionOnly,
    retryPermissions
  };
};
