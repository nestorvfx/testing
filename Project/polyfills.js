// This file provides necessary polyfills for web platform

// For React Native Web
if (typeof window !== 'undefined') {
  // Buffer is required by the Azure Speech SDK
  if (!window.Buffer) {
    window.Buffer = require('buffer').Buffer;
  }
  
  // Check process for Azure Speech SDK
  if (!window.process) {
    window.process = { env: {} };
  } else if (!window.process.env) {
    window.process.env = {};
  }
  
  // Add additional polyfills that may be needed for Azure Speech SDK
  if (typeof window.URL.createObjectURL === 'undefined') {
    window.URL.createObjectURL = (blob) => {
      return '';
    };
  }
}

export default {};
