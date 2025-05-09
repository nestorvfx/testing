/**
 * Android-specific audio fixes and diagnostic tools
 * This module addresses common audio input issues on Android devices
 */

import { Platform, NativeModules } from 'react-native';

// Create a minimal logger for critical errors only
const log = {
  error: (message) => console.error(`[AndroidAudio] ERROR: ${message}`)
};

// Check if we're running on Android
const isAndroid = Platform.OS === 'android';

// Attempt to fix common Android audio issues
export const fixAndroidAudioIssues = async () => {
  if (!isAndroid) {
    return { fixed: false, message: 'Not Android platform' };
  }
  
  try {
    // Check for native audio module
    const hasAudioModule = !!NativeModules.AndroidAudioManager;
    
    if (hasAudioModule) {
      try {
        // Use native module to reset audio routing
        await NativeModules.AndroidAudioManager.resetAudioRoute();
        
        // Get current audio state
        const isMicMuted = await NativeModules.AndroidAudioManager.isMicrophoneMuted();
        
        if (isMicMuted) {
          await NativeModules.AndroidAudioManager.setMicrophoneMute(false);
        }
        
        // Get current audio mode
        const audioMode = await NativeModules.AndroidAudioManager.getMode();
          // Set to communication mode for better voice recognition
        await NativeModules.AndroidAudioManager.setMode(3); // MODE_IN_COMMUNICATION
        
        return { 
          fixed: true, 
          message: 'Applied audio fixes',
          details: {
            wasMuted: isMicMuted,
            previousMode: audioMode
          }
        };
      } catch (err) {
        log.error(`Error using native audio module: ${err.message}`);
      }
    }
    
    // If native module isn't available or fails, try alternative approach
    
    // These fixes use React Native's capabilities without native modules
    
    // 1. Force audio focus request (this might help with certain Android versions)
    if (global.JSAudioFocus && typeof global.JSAudioFocus.requestAudioFocus === 'function') {
      try {
        await global.JSAudioFocus.requestAudioFocus(
          'voice_recognition', // usage
          'mic',              // source
          true                // exclusive
        );
      } catch (err) {
        // Silently continue if this fails
      }
    }    
    return { 
      fixed: true, 
      message: 'Applied generic audio fixes',
      details: {
        nativeModule: false
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
  
  const results = {
    platform: 'android',
    sdkVersion: Platform.Version,
    manufacturer: await getDeviceManufacturer(),
    audioIssues: []
  };
  
  // Check audio permissions
  if (NativeModules.PermissionsAndroid) {
    try {
      const hasRecordPermission = await NativeModules.PermissionsAndroid.check('android.permission.RECORD_AUDIO');
      results.hasAudioPermission = hasRecordPermission;
      
      if (!hasRecordPermission) {
        results.audioIssues.push('missing_permission');
      }
    } catch (err) {
      // Permission check failed
    }
  }
    // Check audio state if native module available
  if (NativeModules.AndroidAudioManager) {
    try {
      results.microphoneMuted = await NativeModules.AndroidAudioManager.isMicrophoneMuted();
      results.audioMode = await NativeModules.AndroidAudioManager.getMode();
      results.musicActive = await NativeModules.AndroidAudioManager.isMusicActive();
      
      if (results.microphoneMuted) {
        results.audioIssues.push('microphone_muted');
      }
      
      if (results.musicActive) {
        results.audioIssues.push('music_active');
      }
      
      if (results.audioMode !== 3) { // Not in communication mode
        results.audioIssues.push('wrong_audio_mode');
      }
    } catch (err) {
      // Failed to get audio state
    }
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
    return 'error';
  }
};

export default {
  fixAndroidAudioIssues,
  diagnoseAndroidAudioIssues
};
