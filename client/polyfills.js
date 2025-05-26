// This file provides necessary polyfills for web platform

// For React Native Web
if (typeof window !== 'undefined') {
  // Buffer is required for binary data handling
  if (!window.Buffer) {
    window.Buffer = require('buffer').Buffer;
  }
  
  // Process object for compatibility
  if (!window.process) {
    window.process = { env: {} };
  } else if (!window.process.env) {
    window.process.env = {};
  }
  
  // Add WebSocket polyfill if needed
  if (typeof window.WebSocket === 'undefined') {
    try {
      window.WebSocket = require('websocket').w3cwebsocket;
    } catch (e) {
      console.warn('WebSocket polyfill not available:', e);
    }
  }
  
  // Add necessary polyfills for OCI WebSocket communication
  if (typeof window.URL.createObjectURL === 'undefined') {
    window.URL.createObjectURL = (blob) => {
      return '';
    };
  }
}

// Import crypto polyfill for OCI authentication
import './src/utils/crypto-polyfill';

export default {};
