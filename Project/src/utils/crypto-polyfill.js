/**
 * Polyfill for crypto.getRandomValues() for React Native Android
 * This is needed for Azure Speech SDK which uses UUID v4 generation
 */

import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  // Only apply polyfill on Android
  if (typeof global.crypto === 'undefined') {
    global.crypto = {};
  }

  if (typeof global.crypto.getRandomValues === 'undefined') {
    global.crypto.getRandomValues = function getRandomValues(array) {
      // Generate random bytes for the array
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    };
  }
}

// Export to ensure the file gets bundled
export default {
  polyfill: true,
};
