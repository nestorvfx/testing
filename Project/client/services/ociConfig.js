/**
 * Oracle Cloud Infrastructure Configuration Module
 * Loads and processes OCI credentials for authenticated API requests
 */
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

// OCI configuration from config file
const OCI_CONFIG = {
  user: 'ocid1.user.oc1..aaaaaaaa6uylf3qeai5ua4qtcv3rq3vwfs4gypav2m57rrfja2q3q3bg6ghq',
  fingerprint: '6b:60:8b:f2:4d:71:78:b9:a8:77:f9:47:87:76:6b:07',
  tenancy: 'ocid1.tenancy.oc1..aaaaaaaasses4fmkswpeztksp4z6idncsuq4unbhfmmocvz4oybdmqqmnepa',
  region: 'eu-amsterdam-1',
  privateKeyPath: 'mihajlo.nestorovic.vfx@gmail.com_2025-05-20T20_12_59.917Z.pem',
  publicKeyPath: 'mihajlo.nestorovic.vfx@gmail.com_2025-05-20T20_12_59.471Z_public.pem',
  compartmentId: 'ocid1.tenancy.oc1..aaaaaaaasses4fmkswpeztksp4z6idncsuq4unbhfmmocvz4oybdmqqmnepa',
};

// Cache for loaded keys
let privateKeyCache = null;
let publicKeyCache = null;

/**
 * Load the contents of a PEM key file
 * 
 * @param {string} keyPath - Path to the key file (relative to config directory)
 * @returns {Promise<string>} - The contents of the key file
 */
export const loadKeyFile = async (keyPath) => {
  try {
    if (Platform.OS === 'web') {
      // For web, we need to fetch the key file directly
      try {
        const response = await fetch(`/config/${keyPath}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch key file: ${response.status} ${response.statusText}`);
        }
        return await response.text();
      } catch (fetchError) {
        console.error('Error fetching key file:', fetchError);
        // Fallback to a dummy key for development purposes only
        console.warn('Using fallback key for development - NOT SECURE FOR PRODUCTION');
        return keyPath;
      }
    } else {
      // For native platforms, read the file contents
      const filePath = `${FileSystem.documentDirectory}config/${keyPath}`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      
      if (!fileInfo.exists) {
        throw new Error(`Key file not found: ${filePath}`);
      }
      
      return await FileSystem.readAsStringAsync(filePath);
    }
  } catch (error) {
    console.error('Error loading key file:', error);
    throw error;
  }
};

/**
 * Get the private key for OCI authentication
 * 
 * @returns {Promise<string>} - The private key contents
 */
export const getPrivateKey = async () => {
  if (!privateKeyCache) {
    privateKeyCache = await loadKeyFile(OCI_CONFIG.privateKeyPath);
  }
  
  return privateKeyCache;
};

/**
 * Get the public key for OCI authentication
 * 
 * @returns {Promise<string>} - The public key contents
 */
export const getPublicKey = async () => {
  if (!publicKeyCache) {
    publicKeyCache = await loadKeyFile(OCI_CONFIG.publicKeyPath);
  }
  
  return publicKeyCache;
};

/**
 * Get the full OCI configuration
 * 
 * @returns {Object} - The OCI configuration
 */
export const getOCIConfig = () => {
  return { ...OCI_CONFIG };
};

/**
 * Format RFC3339 date for OCI API requests
 * 
 * @returns {string} - Formatted date string
 */
export const getRFC3339Date = () => {
  return new Date().toISOString();
};

/**
 * Build a base URL for OCI speech services
 * 
 * @returns {string} - Base URL for OCI speech services
 */
export const getBaseUrl = () => {
  return `https://speech.aiservice.${OCI_CONFIG.region}.oci.oraclecloud.com`;
};

/**
 * Get the WebSocket URL for real-time transcription
 * 
 * @param {string} language - Language code for transcription (e.g., 'en-US')
 * @returns {string} - WebSocket URL
 */
export const getRealtimeWebSocketUrl = (language = 'en-US') => {
  // In a production environment, this URL would need proper authentication
  // For development, we'll connect to a simulated endpoint 
  // that will be rejected by OCI but allows testing the client-side code flow
  
  if (Platform.OS === 'web') {
    // For web, use wss:// protocol
    return `wss://realtime.aiservice.${OCI_CONFIG.region}.oci.oraclecloud.com/20220101/transcriptions` +
           `?compartmentId=${OCI_CONFIG.compartmentId}&language=${language}` +
           `&encoding=pcm&sampleRate=16000&channels=1`;
  } else {
    // For native platforms, use a similar URL
    return `wss://realtime.aiservice.${OCI_CONFIG.region}.oci.oraclecloud.com/20220101/transcriptions` +
           `?compartmentId=${OCI_CONFIG.compartmentId}&language=${language}` +
           `&encoding=pcm&sampleRate=16000&channels=1`;
  }
};

export default {
  getOCIConfig,
  getPrivateKey,
  getPublicKey,
  getRFC3339Date,
  getBaseUrl,
  getRealtimeWebSocketUrl,
};
