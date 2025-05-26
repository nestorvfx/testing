/**
 * Polyfill for Web Crypto API and related functionality
 * This is necessary for OCI Speech Services and other security features
 */

// For React Native Web and Expo Web
if (typeof window !== 'undefined') {
  // If crypto isn't available or missing specific methods
  if (!window.crypto || !window.crypto.subtle) {
    // Basic fallback for crypto (not secure, but prevents crashes)
    if (!window.crypto) {
      window.crypto = {};
    }
    
    if (!window.crypto.subtle) {
      window.crypto.subtle = {
        digest: async (algorithm, data) => {
          // Return a dummy ArrayBuffer (don't use this for actual security)
          return new ArrayBuffer(32);
        },
        // Add support for OCI's RSA-SHA256 signing
        sign: async (algorithm, key, data) => {
          console.warn('Using crypto polyfill for signing - not secure for production');
          return new ArrayBuffer(256);
        },
        importKey: async (format, keyData, algorithm, extractable, keyUsages) => {
          console.warn('Using crypto polyfill for key import - not secure for production');
          return { type: 'private' };
        }
      };
    }
    
    // Provide a basic random values generator if missing
    if (!window.crypto.getRandomValues) {
      window.crypto.getRandomValues = function(array) {
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 256);
        }
        return array;
      };
    }
  }
  
  // Ensure TextEncoder/TextDecoder is available
  if (typeof window.TextEncoder === 'undefined') {
    const TextEncodingPolyfill = require('text-encoding');
    window.TextEncoder = TextEncodingPolyfill.TextEncoder;
    window.TextDecoder = TextEncodingPolyfill.TextDecoder;
  }
    // Add AudioContext polyfill for better audio compatibility
  if (typeof window.AudioContext === 'undefined') {
    window.AudioContext = window.webkitAudioContext || 
                          window.mozAudioContext || 
                          window.msAudioContext;
  }
}

export default {};
