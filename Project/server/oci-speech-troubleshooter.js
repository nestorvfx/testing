/**
 * OCI Speech Authentication Troubleshooter Script
 * 
 * This script performs a thorough validation of your OCI Speech configuration
 * and reports potential issues with authentication and service access.
 * 
 * Usage: node oci-speech-troubleshooter.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const dns = require('dns');
const readline = require('readline');

// Path to config file
const CONFIG_PATH = path.join(__dirname, 'config', 'config.txt');

// Console colors
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

// Utility to print colored output
const print = {
  info: (msg) => console.log(`${COLORS.blue}[INFO]${COLORS.reset} ${msg}`),
  success: (msg) => console.log(`${COLORS.green}[SUCCESS]${COLORS.reset} ${msg}`),
  warning: (msg) => console.log(`${COLORS.yellow}[WARNING]${COLORS.reset} ${msg}`),
  error: (msg) => console.log(`${COLORS.red}[ERROR]${COLORS.reset} ${msg}`),
  section: (msg) => console.log(`\n${COLORS.bold}${COLORS.cyan}=== ${msg} ===${COLORS.reset}\n`),
  detail: (key, value) => console.log(`  ${COLORS.bold}${key}:${COLORS.reset} ${value}`),
  pass: (test) => console.log(`  ${COLORS.green}✓${COLORS.reset} ${test}`),
  fail: (test) => console.log(`  ${COLORS.red}✗${COLORS.reset} ${test}`),
};

/**
 * Check DNS resolution for a hostname
 * @param {string} hostname - Hostname to resolve
 * @returns {Promise<{success: boolean, address?: string, error?: string}>}
 */
const checkDnsResolution = (hostname) => {
  return new Promise((resolve) => {
    dns.lookup(hostname, (err, address) => {
      if (err) {
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true, address });
      }
    });
  });
};

/**
 * Test TCP socket connection to a host
 * @param {string} hostname - Hostname to connect to
 * @param {number} port - Port to connect to
 * @returns {Promise<{success: boolean, message: string}>}
 */
const testSocketConnection = (hostname, port) => {
  return new Promise((resolve) => {
    const net = require('net');
    const socket = new net.Socket();
    socket.setTimeout(5000);
    
    socket.on('connect', () => {
      socket.destroy();
      resolve({ success: true, message: 'Successfully connected' });
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ success: false, message: 'Connection timed out' });
    });
    
    socket.on('error', (err) => {
      resolve({ success: false, message: err.message });
    });
    
    socket.connect(port, hostname);
  });
};

/**
 * Load and validate OCI configuration
 * @returns {Promise<{success: boolean, config?: Object, error?: string}>}
 */
const loadAndValidateConfig = async () => {
  print.section('Loading OCI Configuration');
  
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      print.error(`Configuration file not found at ${CONFIG_PATH}`);
      return { success: false, error: 'Configuration file not found' };
    }
    
    print.info(`Loading config from: ${CONFIG_PATH}`);
    const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
    
    const config = {};
    configData.split('\n').forEach(line => {
      // Skip comments and empty lines
      if (line.trim().startsWith('//') || line.trim().startsWith('[') || !line.trim()) {
        return;
      }
      
      const [key, value] = line.split('=').map(part => part.trim());
      if (key && value) {
        config[key] = value;
      }
    });
    
    print.info('Configuration loaded');
    
    // Required fields
    const requiredFields = ['user', 'fingerprint', 'tenancy', 'region', 'key_file'];
    const missingFields = requiredFields.filter(field => !config[field]);
    
    if (missingFields.length > 0) {
      print.error(`Missing required configuration fields: ${missingFields.join(', ')}`);
      return { success: false, error: `Missing required fields: ${missingFields.join(', ')}` };
    }
    
    // Load the private key
    const privateKeyPath = path.join(__dirname, 'config', config.key_file);
    print.info(`Loading private key from: ${privateKeyPath}`);
    
    if (!fs.existsSync(privateKeyPath)) {
      print.error(`Private key file not found at ${privateKeyPath}`);
      return { success: false, error: 'Private key file not found' };
    }
    
    config.privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    
    // Validate key format
    if (!config.privateKey.includes('PRIVATE KEY')) {
      print.error('Private key file does not appear to be in PEM format');
      return { success: false, error: 'Invalid private key format' };
    }
    
    print.success('Configuration loaded successfully');
    print.detail('User', config.user);
    print.detail('Tenancy', config.tenancy);
    print.detail('Region', config.region);
    
    // Validate field formats
    const validations = [
      { 
        field: 'user', 
        format: /^ocid1\.user\.oc1\..+$/, 
        message: 'User OCID should start with "ocid1.user.oc1."' 
      },
      { 
        field: 'tenancy', 
        format: /^ocid1\.tenancy\.oc1\..+$/, 
        message: 'Tenancy OCID should start with "ocid1.tenancy.oc1."' 
      },
      { 
        field: 'fingerprint', 
        format: /^([0-9a-f]{2}:){15}[0-9a-f]{2}$|^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/, 
        message: 'Fingerprint should be in the format "xx:xx:xx:xx:xx:xx" or "xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx"' 
      },
      { 
        field: 'region', 
        format: /^[a-z]+-[a-z]+-\d+$/, 
        message: 'Region should be in the format "region-name-#"' 
      }
    ];
    
    const invalidFields = validations.filter(v => !v.format.test(config[v.field]));
    
    if (invalidFields.length > 0) {
      invalidFields.forEach(field => {
        print.warning(`Invalid ${field.field} format: ${config[field.field]}`);
        print.warning(field.message);
      });
    }
    
    return { success: true, config };
  } catch (error) {
    print.error(`Error loading configuration: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Sign a request for OCI API
 * @param {Object} request - Request parameters
 * @param {Object} config - OCI configuration
 * @returns {string} Authorization header value
 */
const signRequest = (request, config) => {
  const { host, path, method, headers, privateKey } = request;
  
  // Headers to sign
  const headersToSign = Object.keys(headers)
    .map(key => key.toLowerCase())
    .filter(key => ['host', 'date', '(request-target)'].includes(key))
    .sort();
  
  // Create signing string
  let signingString = '';
  headersToSign.forEach(header => {
    if (header === '(request-target)') {
      signingString += `(request-target): ${method.toLowerCase()} ${path}\n`;
    } else {
      signingString += `${header}: ${headers[header]}\n`;
    }
  });
  
  signingString = signingString.trim();
  
  // Create signature
  const sign = crypto.createSign('sha256');
  sign.update(signingString);
  sign.end();
  
  const signature = sign.sign(privateKey, 'base64');
  
  // Format authorization header
  const keyId = `${config.tenancy}/${config.user}/${config.fingerprint}`;
  const authorization = `Signature version="1",keyId="${keyId}",algorithm="rsa-sha256",headers="${headersToSign.join(' ')}",signature="${signature}"`;
  
  return authorization;
};

/**
 * Make a request to an OCI API endpoint
 * @param {Object} options - Request options
 * @returns {Promise<{statusCode: number, headers: Object, data: string}>}
 */
const makeHttpsRequest = (options) => {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        resolve({
          statusCode: response.statusCode,
          headers: response.headers,
          data
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.end();
  });
};

/**
 * Test OCI Identity API access
 * @param {Object} config - OCI configuration
 * @returns {Promise<{success: boolean, response?: Object, error?: string}>}
 */
const testIdentityApi = async (config) => {
  print.section('Testing OCI Identity API Access');
  
  try {
    const date = new Date().toUTCString();
    const host = `identity.${config.region}.oci.oraclecloud.com`;
    const path = `/20160918/users/${config.user}`;
    
    print.info(`Testing Identity API endpoint: https://${host}${path}`);
    
    // Prepare request for signing
    const requestInfo = {
      host,
      path,
      method: 'GET',
      headers: {
        'host': host,
        'date': date
      },
      privateKey: config.privateKey
    };
    
    // Generate authorization header
    const authorization = signRequest(requestInfo, config);
    
    // Make request to OCI Identity API
    const options = {
      hostname: host,
      port: 443,
      path,
      method: 'GET',
      headers: {
        'Date': date,
        'Authorization': authorization
      }
    };
    
    const response = await makeHttpsRequest(options);
    
    if (response.statusCode === 200) {
      print.success(`Identity API access successful (HTTP ${response.statusCode})`);
      try {
        const userData = JSON.parse(response.data);
        print.detail('User Name', userData.name);
        print.detail('User Description', userData.description || 'None');
        print.detail('User Time Created', userData.timeCreated);
      } catch (e) {
        print.warning('Could not parse user data response');
      }
      return { success: true, response };
    } else {
      print.error(`Identity API access failed (HTTP ${response.statusCode})`);
      print.detail('Response', response.data);
      
      if (response.statusCode === 401) {
        print.warning('Authentication failed. Your credentials may be invalid.');
      } else if (response.statusCode === 404) {
        print.warning('User not found. Check your user OCID.');
      }
      
      return { success: false, response, error: `HTTP ${response.statusCode}` };
    }
  } catch (error) {
    print.error(`Error testing Identity API: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Test DNS resolution and connectivity for OCI Speech service
 * @param {string} region - OCI region
 * @returns {Promise<{dnsSuccess: boolean, socketSuccess: boolean}>}
 */
const testConnectivity = async (region) => {
  print.section('Testing OCI Speech Service Connectivity');
  
  const speechHost = `speech.aiservice.${region}.oci.oraclecloud.com`;
  print.info(`Testing connectivity to: ${speechHost}`);
  
  // Test DNS resolution
  print.info('Checking DNS resolution...');
  const dnsResult = await checkDnsResolution(speechHost);
  
  if (dnsResult.success) {
    print.pass(`DNS resolution successful (${dnsResult.address})`);
  } else {
    print.fail(`DNS resolution failed: ${dnsResult.error}`);
    print.warning('This could indicate that the Speech service is not available in your region.');
  }
  
  // Test socket connection
  print.info('Testing TCP socket connection...');
  const socketResult = await testSocketConnection(speechHost, 443);
  
  if (socketResult.success) {
    print.pass('Socket connection successful');
  } else {
    print.fail(`Socket connection failed: ${socketResult.message}`);
    print.warning('This could indicate network connectivity issues or service unavailability.');
  }
  
  return {
    dnsSuccess: dnsResult.success,
    socketSuccess: socketResult.success
  };
};

/**
 * Test OCI Speech session token endpoint
 * @param {Object} config - OCI configuration
 * @returns {Promise<{success: boolean, response?: Object, error?: string}>}
 */
const testSpeechApi = async (config) => {
  print.section('Testing OCI Speech API Access');
  
  try {
    const date = new Date().toUTCString();
    const host = `speech.aiservice.${config.region}.oci.oraclecloud.com`;
    const path = '/20220101/realtimeSessionTokens'; // Updated from realtimeSessionToken to realtimeSessionTokens
    
    print.info(`Testing Speech API endpoint: https://${host}${path}`);
    
    // Prepare request for signing
    const requestInfo = {
      host,
      path,
      method: 'GET',
      headers: {
        'host': host,
        'date': date
      },
      privateKey: config.privateKey
    };
    
    // Generate authorization header
    const authorization = signRequest(requestInfo, config);
    
    // Make request to OCI Speech API
    const options = {
      hostname: host,
      port: 443,
      path,
      method: 'GET',
      headers: {
        'Date': date,
        'Authorization': authorization
      }
    };
    
    const response = await makeHttpsRequest(options);
    
    if (response.statusCode >= 200 && response.statusCode < 300) {
      print.success(`Speech API access successful (HTTP ${response.statusCode})`);
      try {
        const tokenData = JSON.parse(response.data);
        print.detail('Token Expires At', tokenData.expiresAt);
        print.detail('Token Length', tokenData.token.length);
      } catch (e) {
        print.warning('Could not parse token response');
      }
      return { success: true, response };
    } else {
      print.error(`Speech API access failed (HTTP ${response.statusCode})`);
      print.detail('Response', response.data);
      
      try {
        const errorData = JSON.parse(response.data);
        print.error(`Error Code: ${errorData.code}`);
        print.error(`Error Message: ${errorData.message}`);
        
        // Provide more detailed explanation based on error code
        if (errorData.code === 'NotAuthorizedOrNotFound') {
          print.section('Possible Reasons for NotAuthorizedOrNotFound Error');
          print.info('1. The Speech service may not be enabled in your tenancy');
          print.info('2. Your user/compartment may lack necessary IAM policies');
          print.info('3. The Speech service may not be available in your region');
          print.info('4. Your API request signing may be incorrect');
        }
      } catch (e) {
        // Not JSON or other parsing error
      }
      
      return { success: false, response, error: `HTTP ${response.statusCode}` };
    }
  } catch (error) {
    print.error(`Error testing Speech API: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Generate recommendations based on test results
 * @param {Object} results - Test results
 */
const generateRecommendations = (results) => {
  print.section('Recommendations');
  
  if (!results.configSuccess) {
    print.error('Fix configuration issues before proceeding:');
    print.info('- Ensure your config.txt file has all required fields');
    print.info('- Verify that your private key file exists and is properly formatted');
    return;
  }
  
  if (!results.identitySuccess) {
    print.error('Fix authentication issues:');
    print.info('- Verify your private key matches the uploaded public key in OCI');
    print.info('- Ensure your user OCID, tenancy OCID, and key fingerprint are correct');
    print.info('- Check that your user account is active in OCI');
  }
  
  if (!results.connectivityResults.dnsSuccess) {
    print.error('Speech service endpoint could not be resolved:');
    print.info('- Verify the region spelling is correct');
    print.info('- Check if Speech service is available in your chosen region');
    print.info('- Consider trying a different region where Speech service is available');
  }
  
  if (!results.connectivityResults.socketSuccess) {
    print.error('Could not connect to Speech service:');
    print.info('- Check your network connectivity and firewall settings');
    print.info('- Verify your network allows outbound connections to port 443');
  }
  
  if (!results.speechSuccess) {
    print.error('Speech API access failed:');
    print.info('- Ensure the Speech service is enabled in your tenancy');
    print.info('- Check that appropriate IAM policies are set up for Speech service access');
    print.info('- Verify your compartment has access to Speech service');
    print.info('- Consider checking OCI service limits and quotas');
  }
  
  if (results.configSuccess && results.identitySuccess && 
      results.connectivityResults.dnsSuccess && results.connectivityResults.socketSuccess && 
      !results.speechSuccess) {
    print.warning('Your basic OCI authentication is working, but Speech service access is failing:');
    print.info('This strongly suggests one of the following issues:');
    print.info('1. The Speech service is not enabled for your tenancy');
    print.info('2. Your user/compartment lacks the necessary IAM policies for Speech service');
    print.info('3. You may need to create a service limit/quota request for Speech service');
    
    print.section('Suggested IAM Policy');
    print.info('Add this policy to your compartment (adjust as needed):');
    console.log(`
    Allow group [YourGroup] to use ai-service-speech-family in compartment [YourCompartment]
    Allow group [YourGroup] to use ai-service-speech-family in tenancy
    `);
  }
  
  if (results.allSuccess) {
    print.success('All tests passed! Your OCI Speech configuration appears to be working correctly.');
  }
};

/**
 * Main function to run all tests
 */
const runTests = async () => {
  console.log(`
${COLORS.bold}${COLORS.cyan}==================================================
      OCI Speech Authentication Troubleshooter
==================================================${COLORS.reset}

This script will help diagnose issues with your OCI Speech service authentication.
It will check your configuration, test connectivity, and verify API access.
  `);
  
  const results = {
    configSuccess: false,
    identitySuccess: false,
    connectivityResults: {
      dnsSuccess: false,
      socketSuccess: false
    },
    speechSuccess: false,
    allSuccess: false
  };
  
  // Step 1: Load and validate configuration
  const configResult = await loadAndValidateConfig();
  results.configSuccess = configResult.success;
  
  if (!configResult.success) {
    print.error('Configuration validation failed. Please fix the issues and try again.');
    generateRecommendations(results);
    return;
  }
  
  const config = configResult.config;
  
  // Step 2: Test Identity API access
  const identityResult = await testIdentityApi(config);
  results.identitySuccess = identityResult.success;
  
  // Step 3: Test connectivity to Speech service
  const connectivityResults = await testConnectivity(config.region);
  results.connectivityResults = connectivityResults;
  
  // Step 4: Test Speech API access
  const speechResult = await testSpeechApi(config);
  results.speechSuccess = speechResult.success;
  
  // Overall success
  results.allSuccess = results.configSuccess && 
                      results.identitySuccess && 
                      results.connectivityResults.dnsSuccess &&
                      results.connectivityResults.socketSuccess &&
                      results.speechSuccess;
  
  // Print summary
  print.section('Test Summary');
  print.detail('Configuration', results.configSuccess ? 'PASS' : 'FAIL');
  print.detail('Identity API Access', results.identitySuccess ? 'PASS' : 'FAIL');
  print.detail('DNS Resolution', results.connectivityResults.dnsSuccess ? 'PASS' : 'FAIL');
  print.detail('Socket Connection', results.connectivityResults.socketSuccess ? 'PASS' : 'FAIL');
  print.detail('Speech API Access', results.speechSuccess ? 'PASS' : 'FAIL');
  print.detail('Overall Result', results.allSuccess ? 'PASS' : 'FAIL');
  
  // Generate recommendations
  generateRecommendations(results);
};

// Run all tests
runTests().catch(error => {
  print.error(`Unhandled error: ${error.message}`);
  print.error(error.stack);
});
