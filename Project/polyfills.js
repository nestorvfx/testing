// This file provides necessary polyfills for web platform

// For React Native Web
if (typeof window !== 'undefined') {
  // Buffer is required by the Azure Speech SDK
  window.Buffer = window.Buffer || require('buffer').Buffer;
  
  // Other potential polyfills
  if (!window.process) {
    window.process = { env: {} };
  }
}

export default {};
