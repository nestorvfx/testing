/**
 * OCI API Key Generator Script
 * This script generates a new API key pair for OCI authentication.
 * 
 * Usage: node generate-oci-keys.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Configuration
const CONFIG_DIR = path.join(__dirname, 'config');
const KEY_BASENAME = `api_key_${new Date().toISOString().replace(/:/g, '_')}`;
const PRIVATE_KEY_PATH = path.join(CONFIG_DIR, `${KEY_BASENAME}.pem`);
const PUBLIC_KEY_PATH = path.join(CONFIG_DIR, `${KEY_BASENAME}_public.pem`);
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.txt');

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
};

/**
 * Generate RSA key pair using OpenSSL
 * @returns {Promise<{privateKey: string, publicKey: string}>}
 */
const generateRsaKeysWithOpenssl = async () => {
  try {
    // Try to use OpenSSL command-line
    print.info('Generating keys with OpenSSL CLI...');
    
    // Generate private key
    execSync(`openssl genrsa -out "${PRIVATE_KEY_PATH}" 2048`);
    print.success(`Private key generated at: ${PRIVATE_KEY_PATH}`);
    
    // Generate public key
    execSync(`openssl rsa -pubout -in "${PRIVATE_KEY_PATH}" -out "${PUBLIC_KEY_PATH}"`);
    print.success(`Public key generated at: ${PUBLIC_KEY_PATH}`);
    
    return {
      privateKey: fs.readFileSync(PRIVATE_KEY_PATH, 'utf8'),
      publicKey: fs.readFileSync(PUBLIC_KEY_PATH, 'utf8')
    };
  } catch (error) {
    print.error(`Error generating keys with OpenSSL CLI: ${error.message}`);
    throw error;
  }
};

/**
 * Generate RSA key pair using Node.js crypto module
 * @returns {Promise<{privateKey: string, publicKey: string}>}
 */
const generateRsaKeysWithCrypto = async () => {
  return new Promise((resolve, reject) => {
    try {
      print.info('Generating keys with Node.js crypto module...');
      
      // Generate key pair
      crypto.generateKeyPair('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      }, (err, publicKey, privateKey) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Write keys to files
        fs.writeFileSync(PRIVATE_KEY_PATH, privateKey);
        fs.writeFileSync(PUBLIC_KEY_PATH, publicKey);
        
        print.success(`Private key generated at: ${PRIVATE_KEY_PATH}`);
        print.success(`Public key generated at: ${PUBLIC_KEY_PATH}`);
        
        resolve({ privateKey, publicKey });
      });
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Calculate fingerprint from public key
 * @param {string} publicKey - Public key in PEM format
 * @returns {string} Fingerprint in format xx:xx:xx...
 */
const calculateFingerprint = (publicKey) => {
  try {
    print.info('Calculating key fingerprint...');
    
    // Convert PEM to DER
    const publicKeyDer = crypto.createPublicKey(publicKey).export({ format: 'der', type: 'spki' });
    
    // Calculate SHA1 hash
    const hash = crypto.createHash('sha1').update(publicKeyDer).digest('hex');
    
    // Format as xx:xx:xx...
    const fingerprint = hash.match(/.{2}/g).join(':');
    
    print.success(`Fingerprint calculated: ${fingerprint}`);
    return fingerprint;
  } catch (error) {
    print.error(`Error calculating fingerprint: ${error.message}`);
    throw error;
  }
};

/**
 * Update OCI configuration file
 * @param {string} fingerprint - Key fingerprint
 * @param {string} keyFilename - Private key filename (without path)
 */
const updateConfigFile = (fingerprint, keyFilename) => {
  try {
    print.info(`Updating config file: ${CONFIG_PATH}`);
    
    if (!fs.existsSync(CONFIG_PATH)) {
      print.warning(`Configuration file not found at ${CONFIG_PATH}. Creating a new one.`);
      
      // Create a new config file with placeholders
      const defaultConfig = `[DEFAULT]
user=ocid1.user.oc1..aaaaaaaaxxx
fingerprint=${fingerprint}
tenancy=ocid1.tenancy.oc1..aaaaaaaaxxx
region=us-ashburn-1
key_file=${keyFilename}
`;
      fs.writeFileSync(CONFIG_PATH, defaultConfig);
      print.success('New configuration file created with the new fingerprint and key file.');
      print.warning('You will need to update the user and tenancy OCIDs manually.');
      return;
    }
    
    // Read existing config
    const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
    
    // Update fingerprint and key_file
    let updatedConfig = configData
      .replace(/fingerprint=.*/g, `fingerprint=${fingerprint}`)
      .replace(/key_file=.*/g, `key_file=${keyFilename}`);
    
    // Write updated config
    fs.writeFileSync(CONFIG_PATH, updatedConfig);
    
    print.success('Configuration file updated with new fingerprint and key file.');
  } catch (error) {
    print.error(`Error updating config file: ${error.message}`);
    throw error;
  }
};

/**
 * Main function
 */
const main = async () => {
  print.section('OCI API Key Generator');
  
  try {
    // Create config directory if it doesn't exist
    if (!fs.existsSync(CONFIG_DIR)) {
      print.info(`Creating config directory: ${CONFIG_DIR}`);
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    
    // Generate key pair
    let keyPair;
    try {
      keyPair = await generateRsaKeysWithOpenssl();
    } catch (osslError) {
      print.warning(`OpenSSL CLI failed, falling back to Node.js crypto: ${osslError.message}`);
      keyPair = await generateRsaKeysWithCrypto();
    }
    
    // Calculate fingerprint
    const fingerprint = calculateFingerprint(keyPair.publicKey);
    
    // Update config file
    updateConfigFile(fingerprint, path.basename(PRIVATE_KEY_PATH));
    
    print.section('Next Steps');
    print.info('1. Add this API key to your OCI user account:');
    print.info(`   - Log into OCI Console`);
    print.info(`   - Go to Profile > User Settings > API Keys`);
    print.info(`   - Click "Add API Key"`);
    print.info(`   - Choose "Paste Public Key" and paste the contents of: ${PUBLIC_KEY_PATH}`);
    print.info('');
    print.info('2. Verify your configuration file is correctly updated:');
    print.info(`   - Check ${CONFIG_PATH}`);
    print.info(`   - Ensure user and tenancy OCIDs are correct`);
    print.info('');
    print.info('3. Restart your server and test the authentication again.');
    
  } catch (error) {
    print.error(`Failed to generate OCI API keys: ${error.message}`);
    process.exit(1);
  }
};

// Run the script
main();
