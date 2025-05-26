import dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config();

interface OCIConfig {
  user: string;
  tenancy: string;
  fingerprint: string;
  region: string;
  privateKeyPath: string;
  privateKey?: string;
}

/**
 * Loads OCI configuration from environment variables or config file
 * Environment variables take precedence over config file
 */
export const loadOCIConfig = (): OCIConfig => {
  let config: OCIConfig;

  // Try to load from environment variables first (secure)
  if (process.env.OCI_USER_OCID && 
      process.env.OCI_TENANCY_OCID && 
      process.env.OCI_FINGERPRINT &&
      process.env.OCI_REGION &&
      process.env.OCI_PRIVATE_KEY_PATH) {
    
    console.log('Loading OCI config from environment variables (secure)');
    config = {
      user: process.env.OCI_USER_OCID,
      tenancy: process.env.OCI_TENANCY_OCID,
      fingerprint: process.env.OCI_FINGERPRINT,
      region: process.env.OCI_REGION,
      privateKeyPath: process.env.OCI_PRIVATE_KEY_PATH
    };
  } else {
    // Fallback to config file (less secure, for development only)
    console.warn('WARNING: Loading OCI config from file. Use environment variables in production!');
    config = loadFromConfigFile();
  }

  // Validate configuration
  validateConfig(config);

  // Load private key content if file exists
  if (config.privateKeyPath && fs.existsSync(config.privateKeyPath)) {
    try {
      config.privateKey = fs.readFileSync(config.privateKeyPath, 'utf8');
    } catch (error) {
      console.error('Error reading private key file:', error);
      throw new Error(`Failed to read private key file: ${config.privateKeyPath}`);
    }
  }

  return config;
};

/**
 * Load configuration from config file (fallback)
 */
const loadFromConfigFile = (): OCIConfig => {
  try {
    const configPath = path.resolve(__dirname, '..', 'config', 'config.txt');
    console.log(`Loading OCI config from: ${configPath}`);
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found at ${configPath}`);
    }
    
    const configData = fs.readFileSync(configPath, 'utf8');
    
    const config: any = {};
    configData.split('\n').forEach(line => {
      // Skip comments and empty lines
      if (line.trim().startsWith('//') || line.trim().startsWith('[') || !line.trim()) {
        return;
      }
      
      const [key, value] = line.split('=');
      if (key && value) {
        config[key.trim()] = value.trim();
      }
    });

    return {
      user: config.user,
      tenancy: config.tenancy,
      fingerprint: config.fingerprint,
      region: config.region || 'eu-amsterdam-1',
      privateKeyPath: config.key_file
    };
  } catch (error) {
    console.error('Error loading config file:', error);
    throw new Error('Failed to load OCI configuration');
  }
};

/**
 * Validate that all required configuration values are present
 */
const validateConfig = (config: OCIConfig): void => {
  const required = ['user', 'tenancy', 'fingerprint', 'region'];
  const missing = required.filter(key => !config[key as keyof OCIConfig]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required OCI configuration: ${missing.join(', ')}`);
  }

  // Validate OCID formats
  if (!config.user.startsWith('ocid1.user.oc1.')) {
    throw new Error('Invalid user OCID format');
  }
  
  if (!config.tenancy.startsWith('ocid1.tenancy.oc1.')) {
    throw new Error('Invalid tenancy OCID format');
  }

  // Validate fingerprint format (basic check)
  if (!/^[a-fA-F0-9:]{47}$/.test(config.fingerprint)) {
    console.warn('Fingerprint format may be invalid. Expected format: xx:xx:xx:xx:...');
  }
};

/**
 * Check if configuration contains placeholder values
 */
export const hasPlaceholderValues = (config: OCIConfig): boolean => {
  const placeholders = [
    'YOUR_USER_OCID_HERE',
    'YOUR_TENANCY_OCID_HERE', 
    'YOUR_FINGERPRINT_HERE',
    'path/to/your/private/key.pem'
  ];
  
  return Object.values(config).some(value => 
    placeholders.some(placeholder => value?.includes(placeholder))
  );
};
