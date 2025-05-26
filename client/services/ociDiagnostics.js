/**
 * OCI Diagnostics Utility
 * Helper functions to diagnose and test OCI Speech authentication issues
 */
import { Platform } from 'react-native';
import ociConfig from './ociConfig';

// Configuration for the authentication server
const AUTH_SERVER_URL = Platform.OS === 'web' 
  ? 'http://localhost:3001'  // Local development
  : 'http://localhost:3001'; // For testing - replace with your production URL later

/**
 * Test the connection to the OCI auth server
 * @returns {Promise<Object>} Test results
 */
export const testAuthServerConnection = async () => {
  try {
    console.log('Testing connection to auth server:', AUTH_SERVER_URL);
    
    const startTime = Date.now();
    const response = await fetch(`${AUTH_SERVER_URL}/api/speech/test-config`);
    const endTime = Date.now();
    
    const latency = endTime - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Auth server test failed:', errorText);
      return {
        success: false,
        status: response.status,
        latency,
        error: errorText,
        message: `Failed to connect to auth server: ${response.status} ${response.statusText}`
      };
    }
    
    const data = await response.json();
    console.log('Auth server test succeeded:', data);
    
    return {
      success: true,
      status: response.status,
      latency,
      data,
      message: 'Successfully connected to auth server'
    };
  } catch (error) {
    console.error('Auth server connection test error:', error);
    return {
      success: false,
      error: error.message,
      message: `Error connecting to auth server: ${error.message}`
    };
  }
};

/**
 * Test IAM permissions via the OCI auth server
 * @returns {Promise<Object>} Test results
 */
export const testIAMPermissions = async () => {
  try {
    console.log('Testing IAM permissions via auth server');
    
    const response = await fetch(`${AUTH_SERVER_URL}/api/speech/check-iam`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('IAM test failed:', errorText);
      return {
        success: false,
        status: response.status,
        error: errorText,
        message: `Failed to check IAM permissions: ${response.status} ${response.statusText}`
      };
    }
    
    const data = await response.json();
    console.log('IAM test results:', data);
    
    return {
      success: true,
      status: response.status,
      data,
      message: 'IAM permission check completed'
    };
  } catch (error) {
    console.error('IAM test error:', error);
    return {
      success: false,
      error: error.message,
      message: `Error checking IAM permissions: ${error.message}`
    };
  }
};

/**
 * Test the OCI Speech token endpoint
 * @returns {Promise<Object>} Test results
 */
export const testSpeechToken = async () => {
  try {
    console.log('Testing OCI Speech token endpoint');
    
    const response = await fetch(`${AUTH_SERVER_URL}/api/speech/session-token`);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Speech token test failed:', errorData);
      return {
        success: false,
        status: response.status,
        error: errorData,
        message: `Failed to get speech token: ${response.status} ${response.statusText}`
      };
    }
    
    const data = await response.json();
    console.log('Speech token test succeeded:', data);
    
    return {
      success: true,
      status: response.status,
      token: data.token ? '[REDACTED]' : 'No token returned',
      websocketUrl: data.websocketUrl,
      expiresAt: data.expiresAt,
      message: 'Successfully retrieved speech token'
    };
  } catch (error) {
    console.error('Speech token test error:', error);
    return {
      success: false,
      error: error.message,
      message: `Error getting speech token: ${error.message}`
    };
  }
};

/**
 * Verify the client-side OCI configuration
 * @returns {Object} Configuration status
 */
export const verifyClientConfiguration = () => {
  const config = ociConfig.getOCIConfig();
  
  const validations = {
    tenancy: {
      present: !!config.tenancy,
      validFormat: /^ocid1\.tenancy\.oc1\..+$/.test(config.tenancy)
    },
    user: {
      present: !!config.user,
      validFormat: /^ocid1\.user\.oc1\..+$/.test(config.user)
    },
    fingerprint: {
      present: !!config.fingerprint,
      validFormat: /^([0-9a-f]{2}:){15}[0-9a-f]{2}$/.test(config.fingerprint) || 
                   /^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/.test(config.fingerprint)
    },
    region: {
      present: !!config.region,
      validFormat: /^[a-z]+-[a-z]+-\d+$/.test(config.region)
    },
    compartmentId: {
      present: !!config.compartmentId,
      validFormat: /^ocid1\..+$/.test(config.compartmentId)
    },
    privateKeyPath: {
      present: !!config.privateKeyPath
    },
    publicKeyPath: {
      present: !!config.publicKeyPath
    }
  };
  
  const allValid = Object.values(validations).every(validation => 
    Object.values(validation).every(v => v === true)
  );
  
  return {
    config: {
      ...config,
      // Don't log private key paths for security
      privateKeyPath: config.privateKeyPath ? '[SET]' : '[MISSING]',
      publicKeyPath: config.publicKeyPath ? '[SET]' : '[MISSING]'
    },
    validations,
    speech: {
      baseUrl: ociConfig.getBaseUrl(),
      websocketUrl: ociConfig.getRealtimeWebSocketUrl()
    },
    allValid,
    authServerUrl: AUTH_SERVER_URL
  };
};

/**
 * Run all diagnostic tests
 * @returns {Promise<Object>} All test results
 */
export const runAllDiagnostics = async () => {
  console.log('Running all OCI Speech diagnostics');
  
  const clientConfig = verifyClientConfiguration();
  console.log('Client configuration check:', clientConfig.allValid ? 'PASSED' : 'FAILED');
  
  const authServerTest = await testAuthServerConnection();
  console.log('Auth server connection test:', authServerTest.success ? 'PASSED' : 'FAILED');
  
  let iamTest = null;
  let speechTokenTest = null;
  
  if (authServerTest.success) {
    iamTest = await testIAMPermissions();
    console.log('IAM permissions test:', iamTest.success ? 'PASSED' : 'FAILED');
    
    speechTokenTest = await testSpeechToken();
    console.log('Speech token test:', speechTokenTest.success ? 'PASSED' : 'FAILED');
  }
  
  const diagnosticResults = {
    timestamp: new Date().toISOString(),
    clientConfiguration: clientConfig,
    authServerConnection: authServerTest,
    iamPermissions: iamTest,
    speechToken: speechTokenTest,
    summary: {
      clientConfigValid: clientConfig.allValid,
      authServerReachable: authServerTest.success,
      iamPermissionsValid: iamTest?.success || false,
      speechTokenObtained: speechTokenTest?.success || false,
      overallSuccess: clientConfig.allValid && 
                      authServerTest.success && 
                      (iamTest?.success || false) && 
                      (speechTokenTest?.success || false)
    }
  };
  
  console.log('Diagnostic results:', diagnosticResults);
  return diagnosticResults;
};

export default {
  testAuthServerConnection,
  testIAMPermissions,
  testSpeechToken,
  verifyClientConfiguration,
  runAllDiagnostics
};
