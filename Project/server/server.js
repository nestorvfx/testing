// Server for OCI Speech Authentication
const express = require('express');
const cors = require('cors');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dns = require('dns');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for client requests
app.use(cors());
app.use(express.json());

// Load OCI configuration
const loadConfig = () => {
  try {
    const configPath = path.join(__dirname, 'config', 'config.txt');
    console.log(`Loading config from: ${configPath}`);
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found at ${configPath}`);
    }
    
    const configData = fs.readFileSync(configPath, 'utf8');
    
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
    
    // Required fields
    const requiredFields = ['user', 'fingerprint', 'tenancy', 'region', 'key_file'];
    const missingFields = requiredFields.filter(field => !config[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required configuration fields: ${missingFields.join(', ')}`);
    }
    
    // Load the private key
    const privateKeyPath = path.join(__dirname, 'config', config.key_file);
    console.log(`Loading private key from: ${privateKeyPath}`);
    
    if (!fs.existsSync(privateKeyPath)) {
      throw new Error(`Private key file not found at ${privateKeyPath}`);
    }
    
    config.privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    
    // Validate key format
    if (!config.privateKey.includes('PRIVATE KEY')) {
      throw new Error('Private key file does not appear to be in PEM format');
    }
    
    console.log('Configuration loaded successfully');
    console.log(`- User: ${config.user}`);
    console.log(`- Tenancy: ${config.tenancy}`);
    console.log(`- Region: ${config.region}`);
    
    return config;
  } catch (error) {
    console.error('Error loading configuration:', error);
    throw error;
  }
};

// Helper function to check DNS resolution for the OCI endpoint
const checkDnsResolution = async (hostname) => {
  return new Promise((resolve) => {
    dns.lookup(hostname, (err, address) => {
      if (err) {
        console.error(`DNS resolution failed for ${hostname}:`, err);
        resolve({ success: false, error: err.message });
      } else {
        console.log(`DNS resolution successful for ${hostname}: ${address}`);
        resolve({ success: true, address });
      }
    });
  });
};

// Convert OCI policies to human-readable explanations
const explainOciError = (statusCode, errorMessage) => {
  try {
    let explanation = "Unknown error";
    const error = typeof errorMessage === 'string' ? JSON.parse(errorMessage) : errorMessage;
    
    if (statusCode === 404 && error.code === "NotAuthorizedOrNotFound") {
      explanation = [
        "This error usually means one of the following:",
        "1. The API endpoint URL is incorrect (check region spelling)",
        "2. Your OCI user doesn't have permission to access the Speech service",
        "3. The Speech service is not enabled in your tenancy",
        "4. The compartment ID is incorrect or not accessible",
        "5. Your API signing is incorrect (check key, fingerprint, and user OCIDs)"
      ].join("\n");
    } else if (statusCode === 401) {
      explanation = "Authentication failed. Check your private key, fingerprint, and user/tenancy OCIDs.";
    } else if (statusCode === 403) {
      explanation = "You don't have permission to access this resource. Check your IAM policies.";
    }
    
    return { error, explanation };
  } catch (e) {
    return { error: errorMessage, explanation: "Could not parse error details" };
  }
};

// Sign request for OCI
const signRequest = (request, config) => {
  const {
    host,
    path,
    method,
    headers,
    privateKey
  } = request;
  
  console.log('Creating signature for OCI API request');
  
  // Headers to sign
  const headersToSign = Object.keys(headers)
    .map(key => key.toLowerCase())
    .filter(key => ['host', 'date', '(request-target)'].includes(key))
    .sort();
  
  console.log(`Headers being signed: ${headersToSign.join(', ')}`);
  
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
  console.log('Signing string created');
  
  try {
    // Create signature
    const sign = crypto.createSign('sha256');
    sign.update(signingString);
    sign.end();
    
    const signature = sign.sign(privateKey, 'base64');
    console.log('Signature generated successfully');
    
    // Format authorization header
    const keyId = `${config.tenancy}/${config.user}/${config.fingerprint}`;
    const authorization = `Signature version="1",keyId="${keyId}",algorithm="rsa-sha256",headers="${headersToSign.join(' ')}",signature="${signature}"`;
    
    console.log(`Authorization header created (length: ${authorization.length})`);
    return authorization;
  } catch (error) {
    console.error('Error generating signature:', error);
    throw new Error(`Failed to sign request: ${error.message}`);
  }
};

// Get session token for real-time transcription
app.get('/api/speech/session-token', async (req, res) => {
  try {
    const config = loadConfig();
    const date = new Date().toUTCString();
    const host = `speech.aiservice.${config.region}.oci.oraclecloud.com`;
    const path = '/20220101/realtimeSessionTokens'; // Updated from realtimeSessionToken to realtimeSessionTokens
    
    // According to Oracle API docs, this should be a POST request with a compartmentId
    // Prepare request for signing
    const requestInfo = {
      host,
      path,
      method: 'POST',
      headers: {
        'host': host,
        'date': date,
        'content-type': 'application/json'
      },
      privateKey: config.privateKey
    };
      // Generate authorization header
    const authorization = signRequest(requestInfo, config);
    
    // Detailed logging for debugging
    console.log('=== OCI Speech API Request Details ===');
    console.log(`Host: ${host}`);
    console.log(`Path: ${path}`);
    console.log(`Region: ${config.region}`);
    console.log(`Tenancy: ${config.tenancy}`);
    console.log(`User OCID: ${config.user}`);
    console.log(`Key Fingerprint: ${config.fingerprint}`);
    console.log(`Date Header: ${date}`);
    console.log('=== End Request Details ===');
      // Make request to OCI API
    const requestBody = JSON.stringify({
      compartmentId: config.tenancy
    });
    
    const options = {
      hostname: host,
      port: 443,
      path,
      method: 'POST',
      headers: {
        'Date': date,
        'Authorization': authorization,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };
    
    console.log('Full request options:', JSON.stringify({
      ...options,
      headers: {
        ...options.headers,
        'Authorization': '[REDACTED]' // Don't log the full auth header for security
      },
      body: requestBody
    }, null, 2));
      // Create HTTPS request
    const tokenRequest = new Promise((resolve, reject) => {
      const req = https.request(options, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          console.log(`OCI API Response Status: ${response.statusCode}`);
          console.log(`OCI API Response Headers:`, JSON.stringify(response.headers, null, 2));
          
          if (response.statusCode >= 200 && response.statusCode < 300) {
            try {
              const parsedData = JSON.parse(data);
              console.log('OCI API Response Data:', JSON.stringify(parsedData, null, 2));
              resolve(parsedData);
            } catch (parseError) {
              console.error('Error parsing OCI API response:', parseError);
              console.error('Raw response data:', data);
              reject({
                statusCode: response.statusCode,
                message: `Failed to parse response: ${parseError.message}`,
                rawData: data
              });
            }
          } else {
            console.error(`OCI API Error (${response.statusCode}):`, data);
            reject({
              statusCode: response.statusCode,
              message: data
            });
          }
        });
      });
        req.on('error', (error) => {
        console.error('Network error during OCI API request:', error);
        reject(error);
      });
      
      // Write request body for POST request
      req.write(requestBody);
      req.end();
    });
    
    const token = await tokenRequest;
    
    // Return token to client
    res.json({
      token: token.token,
      websocketUrl: `wss://realtime.aiservice.${config.region}.oci.oraclecloud.com/20220101/transcriptions` +
                   `?compartmentId=${config.tenancy}&languageCode=en-US&encoding=pcm&sampleRate=16000&channels=1`,
      expiresAt: token.expiresAt
    });
      } catch (error) {
    console.error('Error getting session token:', error);
    
    // Detailed error logging
    if (error.statusCode) {
      console.error(`OCI API Error Status: ${error.statusCode}`);
      try {
        // Try to parse error message as JSON if it is one
        const errorDetail = typeof error.message === 'string' && error.message.trim().startsWith('{') 
          ? JSON.parse(error.message) 
          : error.message;
        console.error('Error Details:', JSON.stringify(errorDetail, null, 2));
        
        // Get human-readable explanation
        const { explanation } = explainOciError(error.statusCode, errorDetail);
        console.error('Possible explanation:', explanation);
      } catch (parseError) {
        console.error('Raw Error Message:', error.message);
      }
    }
    
    // Check for common error causes
    const config = loadConfig();
    console.log('Validation checks:');
    console.log(`- Private key file exists: ${fs.existsSync(path.join(__dirname, 'config', config.key_file))}`);
    console.log(`- Key file path: ${path.join(__dirname, 'config', config.key_file)}`);
    console.log(`- Region format valid: ${/^[a-z]+-[a-z]+-\d+$/.test(config.region)}`);
    console.log(`- OCI Speech endpoint for region ${config.region}: speech.aiservice.${config.region}.oci.oraclecloud.com`);
    
    // Check if tenancy and user IDs follow OCI format
    console.log(`- Tenancy ID format valid: ${/^ocid1\.tenancy\.oc1\..+$/.test(config.tenancy)}`);
    console.log(`- User ID format valid: ${/^ocid1\.user\.oc1\..+$/.test(config.user)}`);
    console.log(`- Fingerprint format valid: ${/^([0-9a-f]{2}:){15}[0-9a-f]{2}$/.test(config.fingerprint)}`);
    
    // Test DNS resolution
    const host = `speech.aiservice.${config.region}.oci.oraclecloud.com`;
    checkDnsResolution(host).then(result => {
      console.log(`- DNS resolution for ${host}: ${result.success ? 'Success' : 'Failed'}`);
    });
    
    res.status(error.statusCode || 500).json({
      error: 'Failed to get session token',
      details: error.message,
      statusCode: error.statusCode || 500
    });  }
});

// Add a diagnostic endpoint
app.get('/api/speech/test-config', async (req, res) => {
  try {
    // Test config loading
    const config = loadConfig();
    
    // Check for required fields
    const requiredFields = ['user', 'fingerprint', 'tenancy', 'region', 'key_file', 'privateKey'];
    const configStatus = {};
    
    requiredFields.forEach(field => {
      if (field === 'privateKey') {
        configStatus[field] = config[field] ? 'Present (content not shown)' : 'Missing';
      } else {
        configStatus[field] = config[field] || 'Missing';
      }
    });
    
    // Test connectivity to OCI
    const host = `speech.aiservice.${config.region}.oci.oraclecloud.com`;
    const dnsResult = await checkDnsResolution(host);
    
    // Perform a TCP socket connection test to the endpoint
    const socketTest = await new Promise((resolve) => {
      const socket = new require('net').Socket();
      socket.setTimeout(5000);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve({ success: true, message: 'Successfully connected to endpoint' });
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve({ success: false, message: 'Connection timed out' });
      });
      
      socket.on('error', (err) => {
        resolve({ success: false, message: err.message });
      });
      
      socket.connect(443, host);
    });
    
    res.json({
      status: 'Configuration loaded',
      config: configStatus,
      speechEndpoint: host,
      privateKeyFileExists: fs.existsSync(path.join(__dirname, 'config', config.key_file)),
      dnsResolution: dnsResult,
      socketConnection: socketTest,
      validations: {
        tenancyIdFormat: /^ocid1\.tenancy\.oc1\..+$/.test(config.tenancy),
        userIdFormat: /^ocid1\.user\.oc1\..+$/.test(config.user),
        fingerprintFormat: /^([0-9a-f]{2}:){15}[0-9a-f]{2}$/.test(config.fingerprint) || 
                          /^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/.test(config.fingerprint),
        regionFormat: /^[a-z]+-[a-z]+-\d+$/.test(config.region)
      },
      message: 'Use the /api/speech/session-token endpoint to test full authentication'
    });
  } catch (error) {
    res.status(500).json({
      status: 'Configuration error',
      error: error.message
    });
  }
});

// Add an endpoint to test the Speech API specifically
app.get('/api/speech/test-speech', async (req, res) => {
  try {
    const config = loadConfig();
    const date = new Date().toUTCString();
    
    // Test Speech API
    const speechHost = `speech.aiservice.${config.region}.oci.oraclecloud.com`;
    const speechPath = '/20220101/realtimeSessionTokens'; // In testSpeechApi function
    
    // According to Oracle API docs, this should be a POST request with a compartmentId
    const requestInfo = {
      host: speechHost,
      path: speechPath,
      method: 'POST',
      headers: {
        'host': speechHost,
        'date': date,
        'content-type': 'application/json'
      },
      privateKey: config.privateKey
    };
    
    // Generate authorization header
    const authorization = signRequest(requestInfo, config);
    
    // Request body with compartmentId
    const requestBody = JSON.stringify({
      compartmentId: config.tenancy
    });
    
    // Make request to OCI Speech API
    const speechTest = await new Promise((resolve, reject) => {
      const options = {
        hostname: speechHost,
        port: 443,
        path: speechPath,
        method: 'POST',
        headers: {
          'Date': date,
          'Authorization': authorization,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody)
        }
      };
      
      const req = https.request(options, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode,
            headers: response.headers,
            data: data
          });
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      // Write request body for POST request
      req.write(requestBody);
      req.end();
    });
    
    // Parse the response data if it's JSON
    let parsedData = null;
    try {
      if (speechTest.data && typeof speechTest.data === 'string') {
        parsedData = JSON.parse(speechTest.data);
      }
    } catch (e) {
      console.log('Could not parse speech API response:', e);
    }
    
    // Return test results
    res.json({
      speechApiTest: {
        endpoint: `https://${speechHost}${speechPath}`,
        statusCode: speechTest.statusCode,
        success: speechTest.statusCode >= 200 && speechTest.statusCode < 300,
        message: speechTest.statusCode === 200 
          ? 'Speech API access successful' 
          : 'Speech API access failed',
        responseData: parsedData || speechTest.data
      },
      requestDetails: {
        method: 'POST',
        headers: [
          'Date',
          'Authorization',
          'Content-Type',
          'Content-Length'
        ],
        body: { compartmentId: config.tenancy }
      },
      conclusion: speechTest.statusCode === 200 
        ? 'Speech API is accessible with your current credentials and configuration.'
        : 'Failed to access Speech API. Check error details and ensure the service is enabled in your tenancy.'
    });
  } catch (error) {
    res.status(500).json({
      status: 'Speech API test error',
      error: error.message
    });
  }
});

// Add an endpoint to check IAM permissions
app.get('/api/speech/check-iam', async (req, res) => {
  try {
    const config = loadConfig();
    const date = new Date().toUTCString();
    
    // First test identity endpoint to validate basic authentication
    const identityHost = `identity.${config.region}.oci.oraclecloud.com`;
    const identityPath = '/20160918/users/' + config.user;
    
    // Prepare request for signing
    const requestInfo = {
      host: identityHost,
      path: identityPath,
      method: 'GET',
      headers: {
        'host': identityHost,
        'date': date
      },
      privateKey: config.privateKey
    };
    
    // Generate authorization header
    const authorization = signRequest(requestInfo, config);
    
    // Make request to OCI Identity API to check if credentials are valid
    const identityTest = await new Promise((resolve, reject) => {
      const options = {
        hostname: identityHost,
        port: 443,
        path: identityPath,
        method: 'GET',
        headers: {
          'Date': date,
          'Authorization': authorization
        }
      };
      
      const req = https.request(options, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode,
            headers: response.headers,
            data: data
          });
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.end();
    });
    
    // Return test results
    res.json({
      identityApiTest: {
        endpoint: `https://${identityHost}${identityPath}`,
        statusCode: identityTest.statusCode,
        success: identityTest.statusCode >= 200 && identityTest.statusCode < 300,
        message: identityTest.statusCode === 200 
          ? 'Authentication successful' 
          : 'Authentication failed'
      },
      conclusion: identityTest.statusCode === 200 
        ? 'Your OCI credentials are valid. If Speech API is failing, the issue is likely with Speech service permissions or service availability.'
        : 'Your OCI credentials appear to be invalid or misconfigured.'
    });
  } catch (error) {
    res.status(500).json({
      status: 'IAM check error',
      error: error.message
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`OCI Speech Auth Server running on port ${PORT}`);
});
