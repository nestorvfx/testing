/**
 * OCI Speech API Key Validator
 * 
 * This script validates and tests your OCI API key configuration
 * specifically for Speech service access.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

// Console colors for better readability
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

// Helper for colorized output
const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  title: (msg) => console.log(`\n${colors.bold}${colors.cyan}=== ${msg} ===${colors.reset}\n`)
};

// Configuration 
const CONFIG_PATH = path.join(__dirname, 'config', 'config.txt');

// Load OCI configuration
const loadConfig = () => {
  try {
    log.info(`Loading config from: ${CONFIG_PATH}`);
    
    if (!fs.existsSync(CONFIG_PATH)) {
      throw new Error(`Configuration file not found at ${CONFIG_PATH}`);
    }
    
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
    
    // Required fields
    const requiredFields = ['user', 'fingerprint', 'tenancy', 'region', 'key_file'];
    const missingFields = requiredFields.filter(field => !config[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required configuration fields: ${missingFields.join(', ')}`);
    }
    
    // Load the private key
    const privateKeyPath = path.join(__dirname, 'config', config.key_file);
    log.info(`Loading private key from: ${privateKeyPath}`);
    
    if (!fs.existsSync(privateKeyPath)) {
      throw new Error(`Private key file not found at ${privateKeyPath}`);
    }
    
    config.privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    
    log.success('Configuration loaded successfully');
    return config;
  } catch (error) {
    log.error(`Error loading configuration: ${error.message}`);
    throw error;
  }
};

// Validate a PEM format key
const validatePemKey = (key, keyType = 'private') => {
  log.title(`Validating ${keyType} key`);
  
  try {
    // Check for proper PEM format header/footer
    const expectedHeader = keyType === 'private' 
      ? '-----BEGIN PRIVATE KEY-----' 
      : '-----BEGIN PUBLIC KEY-----';
    const expectedFooter = keyType === 'private' 
      ? '-----END PRIVATE KEY-----' 
      : '-----END PUBLIC KEY-----';
    
    // RSA specific headers/footers are also valid
    const alternateHeader = keyType === 'private' 
      ? '-----BEGIN RSA PRIVATE KEY-----' 
      : null;
    const alternateFooter = keyType === 'private' 
      ? '-----END RSA PRIVATE KEY-----' 
      : null;
    
    // Check headers
    const hasExpectedHeader = key.includes(expectedHeader);
    const hasAlternateHeader = alternateHeader && key.includes(alternateHeader);
    const hasExpectedFooter = key.includes(expectedFooter);
    const hasAlternateFooter = alternateFooter && key.includes(alternateFooter);
    
    if (!(hasExpectedHeader || hasAlternateHeader)) {
      log.error(`Key does not have a valid ${keyType} key header`);
      log.error(`Expected: ${expectedHeader} or ${alternateHeader}`);
      return false;
    }
    
    if (!(hasExpectedFooter || hasAlternateFooter)) {
      log.error(`Key does not have a valid ${keyType} key footer`);
      log.error(`Expected: ${expectedFooter} or ${alternateFooter}`);
      return false;
    }
    
    // Try to load the key with crypto module
    if (keyType === 'private') {
      crypto.createPrivateKey(key);
    } else {
      crypto.createPublicKey(key);
    }
    
    log.success(`${keyType.charAt(0).toUpperCase() + keyType.slice(1)} key is valid`);
    return true;
  } catch (error) {
    log.error(`Invalid ${keyType} key: ${error.message}`);
    return false;
  }
};

// Validate fingerprint format and potentially check against the public key
const validateFingerprint = (fingerprint, publicKey = null) => {
  log.title('Validating API key fingerprint');
  
  // Check format (expecting xx:xx:xx:xx:xx:xx format or longer)
  const fingerprintRegex = /^([0-9a-f]{2}:){5}[0-9a-f]{2}$|^([0-9a-f]{2}:){15}[0-9a-f]{2}$/i;
  
  if (!fingerprintRegex.test(fingerprint)) {
    log.error(`Fingerprint format is invalid: ${fingerprint}`);
    log.info('Expected format: xx:xx:xx:xx:xx:xx or xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx');
    return false;
  }
  
  log.success(`Fingerprint format is valid: ${fingerprint}`);
  
  // If public key is provided, verify the fingerprint matches
  if (publicKey) {
    try {
      // Extract public key and calculate fingerprint
      const pubKeyObj = crypto.createPublicKey(publicKey);
      const pubKeyDer = pubKeyObj.export({ type: 'spki', format: 'der' });
      const calculatedFingerprint = crypto
        .createHash('sha1')
        .update(pubKeyDer)
        .digest('hex')
        .match(/.{2}/g)
        .join(':');
      
      if (calculatedFingerprint.toLowerCase() !== fingerprint.toLowerCase()) {
        log.error('Fingerprint does not match the public key');
        log.info(`Provided fingerprint: ${fingerprint}`);
        log.info(`Calculated fingerprint: ${calculatedFingerprint}`);
        return false;
      }
      
      log.success('Fingerprint matches the public key');
    } catch (error) {
      log.error(`Error verifying fingerprint against public key: ${error.message}`);
      return false;
    }
  }
  
  return true;
};

// Create a test request to the Speech API
const testSpeechApi = async (config) => {
  log.title('Testing OCI Speech API Connection');
  
  try {
    // Set up request parameters
    const date = new Date().toUTCString();
    const speechHost = `speech.aiservice.${config.region}.oci.oraclecloud.com`;
    const speechPath = '/20220101/realtimeSessionTokens'; // Updated from realtimeSessionToken to realtimeSessionTokens
    
    log.info(`Testing endpoint: https://${speechHost}${speechPath}`);
    log.info(`Region: ${config.region}`);
    
    // Create the signing string for the API request
    const headersToSign = ['date', 'host'];
    
    let signingString = `date: ${date}\nhost: ${speechHost}`;
    
    log.info('Creating API request signature...');
    
    // Sign the request
    const sign = crypto.createSign('sha256');
    sign.update(signingString);
    sign.end();
    
    const signature = sign.sign(config.privateKey, 'base64');
    
    // Create authorization header
    const keyId = `${config.tenancy}/${config.user}/${config.fingerprint}`;
    const authorization = `Signature version="1",keyId="${keyId}",algorithm="rsa-sha256",headers="${headersToSign.join(' ')}",signature="${signature}"`;
    
    // Request body with compartmentId (required for POST to realtimeSessionToken)
    const requestBody = JSON.stringify({
      compartmentId: config.tenancy
    });
    
    // Create request options
    const options = {
      hostname: speechHost,
      port: 443,
      path: speechPath,
      method: 'POST',
      headers: {
        'Date': date,
        'Host': speechHost,
        'Authorization': authorization,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };
    
    log.info('Sending request to OCI Speech API...');
    
    // Send the request
    return new Promise((resolve, reject) => {
      const req = https.request(options, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          log.info(`API response status: ${response.statusCode}`);
          
          if (response.statusCode >= 200 && response.statusCode < 300) {
            log.success('API request successful');
            try {
              const parsedData = JSON.parse(data);
              resolve({
                success: true,
                statusCode: response.statusCode,
                data: parsedData
              });
            } catch (error) {
              log.warning(`Error parsing response: ${error.message}`);
              resolve({
                success: true,
                statusCode: response.statusCode,
                data: data
              });
            }
          } else {
            log.error(`API request failed with status ${response.statusCode}`);
            try {
              const parsedData = JSON.parse(data);
              log.error(`Error code: ${parsedData.code}`);
              log.error(`Error message: ${parsedData.message}`);
              resolve({
                success: false,
                statusCode: response.statusCode,
                error: parsedData
              });
            } catch (error) {
              log.error(`Raw response: ${data}`);
              resolve({
                success: false,
                statusCode: response.statusCode,
                error: data
              });
            }
          }
        });
      });
      
      req.on('error', (error) => {
        log.error(`Network error: ${error.message}`);
        reject(error);
      });
      
      // Write the request body
      req.write(requestBody);
      req.end();
    });
  } catch (error) {
    log.error(`Error in API test: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
};

// Main function
const main = async () => {
  console.log(`
${colors.bold}${colors.cyan}=================================================
        OCI Speech API Key Validator
=================================================${colors.reset}

This script validates your OCI API keys and configuration
for use with the Speech service.
  `);
  
  try {
    // Step 1: Load configuration
    const config = loadConfig();
    
    // Step 2: Validate private key
    validatePemKey(config.privateKey, 'private');
    
    // Step 3: Validate fingerprint
    validateFingerprint(config.fingerprint);
    
    // Step 4: Test Speech API connection
    const apiTest = await testSpeechApi(config);
    
    // Step 5: Summarize results
    log.title('Results Summary');
    
    if (apiTest.success) {
      log.success('OCI Speech API connection successful');
      
      if (apiTest.data && apiTest.data.token) {
        log.info('Successfully obtained session token');
        log.info(`Token expiry: ${apiTest.data.expiresAt || 'unknown'}`);
      }
    } else {
      log.error('OCI Speech API connection failed');
      
      if (apiTest.statusCode === 404) {
        log.warning('The 404 error usually indicates one of these issues:');
        log.info('1. The Speech service is not enabled in your tenancy');
        log.info('2. Your user does not have permission to access the Speech service');
        log.info('3. The Speech service is not available in your region');
        log.info('4. The API endpoint URL is incorrect');
      } else if (apiTest.statusCode === 401) {
        log.warning('The 401 error indicates authentication failure:');
        log.info('1. Your private key might not match the public key in OCI');
        log.info('2. Your fingerprint might be incorrect');
        log.info('3. Your user or tenancy OCID might be incorrect');
      }
    }
    
    log.info('\nFor Speech service, ensure you have:');
    log.info('- Subscribed to Speech service in your OCI tenancy');
    log.info('- Proper IAM policies allowing access to ai-service-speech-family');
    log.info('- Confirmed Speech service is available in your selected region');
    
  } catch (error) {
    log.error(`Script execution failed: ${error.message}`);
  }
};

// Run the script
main().catch(error => {
  console.error(`Unhandled error: ${error.message}`);
});
