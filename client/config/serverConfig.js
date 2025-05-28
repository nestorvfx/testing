/**
 * Server Configuration for Different Environments
 * 
 * This file manages the server URLs for development and production environments.
 * Update the PRODUCTION_SERVER_URL with your Oracle Cloud instance IP after deployment.
 */

import { Platform } from 'react-native';

// 🔧 CONFIGURATION - Updated for Oracle Cloud deployment (Port 8080)
const PRODUCTION_SERVER_URL = 'http://143.47.180.235:8080'; // Oracle Cloud server IP with working port

// Development server URLs
const DEVELOPMENT_URLS = {
  web: 'http://localhost:8450',
  android: 'http://192.168.8.101:8450',
  ios: 'http://localhost:8450'
};

/**
 * Get the appropriate server URL based on environment and platform
 */
export const getServerUrl = () => {
  // Check if we're in production mode
  const isProduction = __DEV__ === false;
  
  if (isProduction) {
    console.log('🚀 Using production server:', PRODUCTION_SERVER_URL);
    return PRODUCTION_SERVER_URL;
  }
  
  // Development mode - use platform-specific URLs
  const devUrl = DEVELOPMENT_URLS[Platform.OS] || DEVELOPMENT_URLS.web;
  console.log('🔧 Using development server:', devUrl);
  return devUrl;
};

/**
 * Manual override for testing production server in development
 * Set this to true to test against production server during development
 */
const FORCE_PRODUCTION_URL = true;

export const getServerUrlWithOverride = () => {
  if (FORCE_PRODUCTION_URL) {
    console.log('⚠️ Forcing production server URL in development');
    return PRODUCTION_SERVER_URL;
  }
  return getServerUrl();
};

export default {
  getServerUrl,
  getServerUrlWithOverride,
  PRODUCTION_SERVER_URL,
  DEVELOPMENT_URLS
};
