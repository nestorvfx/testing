/**
 * Android-specific audio fixes
 * This module provides audio configuration for Android
 */

import { Platform, NativeModules, PermissionsAndroid } from 'react-native';

// Create a minimal logger for critical errors only
const log = {
  debug: (message) => console.debug(`[AndroidAudio] ${message}`),
  info: (message) => console.info(`[AndroidAudio] ${message}`),
  error: (message) => console.error(`[AndroidAudio] ERROR: ${message}`),
  warn: (message) => console.warn(`[AndroidAudio] WARN: ${message}`)
};

// Check if we're running on Android
const isAndroid = Platform.OS === 'android';

// Attempt to fix common Android audio issues
export const fixAndroidAudioIssues = async () => {
  if (!isAndroid) {
    return { fixed: false, message: 'Not Android platform' };
  }
  
  log.debug('Starting Android audio fixes for Azure speech recognition');
  
  try {
    // Check microphone permission directly with PermissionsAndroid
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: "Microphone Permission",
          message: "This app needs access to your microphone for speech recognition.",
          buttonNeutral: "Ask Me Later",
          buttonNegative: "Cancel",
          buttonPositive: "OK"
        }
      );
      
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        log.warn('Microphone permission not granted');
        return { 
          fixed: false, 
          message: 'Microphone permission not granted' 
        };
      }
      
      log.info('Microphone permission confirmed');
    } catch (permErr) {
      log.warn(`Error checking permissions: ${permErr.message}`);
    }
    
    // Microphone pre-initialization is now handled by the native module
    log.info('Successfully applied audio configuration for Azure speech recognition');
    
    return { 
      fixed: true, 
      message: 'Applied Android audio configuration for Azure speech recognition',
      details: {
        provider: 'native'
      }
    };
  } catch (error) {
    log.error(`Error in Android audio fix: ${error.message}`);
    return {
      fixed: false,
      message: `Failed to apply audio fixes: ${error.message}`
    };
  }
};

// Function to diagnose audio issues
export const diagnoseAndroidAudioIssues = async () => {
  if (!isAndroid) {
    return { platform: 'not-android' };
  }
  
  log.debug('Starting Android audio diagnostics');
  
  const results = {
    platform: 'android',
    sdkVersion: Platform.Version,
    manufacturer: await getDeviceManufacturer(),
    audioIssues: [],
    model: Platform.constants?.model || 'unknown',
    brand: Platform.constants?.brand || 'unknown',
    androidAPILevel: Platform.Version,
    timestamp: new Date().toISOString()
  };
  
  log.info(`Device info: ${results.manufacturer} ${results.model}, Android ${results.androidAPILevel}`);
  
  // Check microphone permission
  try {
    const permissionStatus = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
    );
    
    results.microphonePermission = permissionStatus;
    
    if (!permissionStatus) {
      results.audioIssues.push('microphone_permission_missing');
      log.warn('Microphone permission not granted');
    } else {
      log.info('Microphone permission granted');
    }
  } catch (permErr) {
    log.warn(`Could not check permission: ${permErr.message}`);
    results.audioIssues.push('microphone_permission_error');
  }
  
  // Check custom module availability
  try {
    const { AzureContinuousSpeech } = NativeModules;
    if (AzureContinuousSpeech) {
      results.customModuleAvailable = true;
      log.info('Custom speech module is available');
    } else {
      results.customModuleAvailable = false;
      results.audioIssues.push('custom_module_unavailable');
      log.warn('Custom speech module not available');
    }
  } catch (moduleErr) {
    results.customModuleAvailable = false;
    results.audioIssues.push('custom_module_error');
    log.error(`Error checking custom module: ${moduleErr.message}`);
  }
  
  // Log all detected issues
  if (results.audioIssues.length > 0) {
    log.warn(`Detected ${results.audioIssues.length} audio issues: ${results.audioIssues.join(', ')}`);
  } else {
    log.info('No audio issues detected');
  }
  
  return results;
};

// Helper function to get device manufacturer
const getDeviceManufacturer = async () => {
  try {
    if (Platform.constants && Platform.constants.manufacturer) {
      return Platform.constants.manufacturer;
    }
    return 'unknown';
  } catch (err) {
    log.error(`Failed to get device manufacturer: ${err.message}`);
    return 'error';
  }
};

// Test microphone functionality directly with the native module
export const testMicrophone = async () => {
  if (!isAndroid) return { working: true, reason: 'non-android-platform' };
  
  log.debug('Starting microphone test');
  
  try {
    // Check permissions using PermissionsAndroid
    const permissionStatus = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
    );
    
    if (!permissionStatus) {
      log.warn('Microphone permission not granted');
      return { working: false, reason: 'permission-denied' };
    }
    
    // Check if the native module is available
    const { AzureContinuousSpeech } = NativeModules;
    if (!AzureContinuousSpeech) {
      log.warn('Custom speech module not available');
      return { 
        working: false, 
        reason: 'custom-module-unavailable' 
      };
    }
    
    // Try to initialize the custom module to see if it can access the microphone
    try {
      const isAvailable = await AzureContinuousSpeech.isAvailable();
      if (isAvailable) {
        log.info('Custom speech module can access microphone');
        return { 
          working: true, 
          reason: 'native-module-test-successful' 
        };
      } else {
        log.warn('Custom speech module cannot access microphone');
        return { 
          working: false, 
          reason: 'native-module-unavailable' 
        };
      }
    } catch (moduleErr) {
      log.warn(`Custom module test failed: ${moduleErr.message}`);
      return { 
        working: false, 
        reason: 'native-module-error',
        error: moduleErr.message 
      };
    }
  } catch (err) {
    log.error(`Microphone test failed: ${err.message}`);
    return { working: false, reason: 'test-error', error: err.message };
  }
};

export default {
  fixAndroidAudioIssues,
  diagnoseAndroidAudioIssues,
  testMicrophone
};
