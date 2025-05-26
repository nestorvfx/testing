/**
 * Permission utilities for handling Android runtime permissions
 */
import { Platform, PermissionsAndroid } from 'react-native';

/**
 * Request microphone permission on Android
 * @returns {Promise<boolean>} True if permission granted, false otherwise
 */
export const requestMicrophonePermission = async () => {
  if (Platform.OS !== 'android') {
    return true; // iOS and web handle permissions differently
  }

  try {
    console.log('Requesting microphone permission...');
    
    // Check if permission is already granted
    const hasPermission = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
    );
    
    if (hasPermission) {
      console.log('Microphone permission already granted');
      return true;
    }
    
    // Request permission
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone Permission',
        message: 'This app needs access to your microphone to record audio for speech recognition.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      }
    );
    
    const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
    console.log('Microphone permission request result:', granted, 'granted:', isGranted);
    
    return isGranted;
  } catch (error) {
    console.error('Error requesting microphone permission:', error);
    return false;
  }
};

/**
 * Check if microphone permission is granted
 * @returns {Promise<boolean>} True if permission granted, false otherwise
 */
export const checkMicrophonePermission = async () => {
  if (Platform.OS !== 'android') {
    return true; // iOS and web handle permissions differently
  }

  try {
    const hasPermission = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
    );
    
    console.log('Microphone permission check result:', hasPermission);
    return hasPermission;
  } catch (error) {
    console.error('Error checking microphone permission:', error);
    return false;
  }
};
