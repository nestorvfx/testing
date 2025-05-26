/**
 * Speech Recognition Fallback Mechanisms
 * This file contains fallback implementations for rare cases
 * when the main OCI Speech service is unavailable.
 * We do not use Web Speech API per requirements.
 */
import { Platform } from 'react-native';

// Stub for Web Speech API - always returns null to prevent usage
export const setupWebSpeechFallback = () => {
  console.log('Web Speech API fallback requested but disabled per requirements');
  return null;
};

// Stub for Android module - always returns null to prevent usage
export const setupAndroidContinuousFallback = async () => {
  console.log('Android continuous speech fallback requested but disabled per requirements');
  return null;
};

/**
 * Configure the speech recognizer with the provided options
 * @param {Object} options - Configuration options
 * @returns {Promise<boolean>} - Whether configuration was successful
 */
export const configureSpeechRecognition = async (options = {}) => {
  console.log('Speech recognition configuration requested but disabled per requirements');
  return false;
};

export default {
  setupWebSpeechFallback,
  setupAndroidContinuousFallback,
  configureSpeechRecognition
};
