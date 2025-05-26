import express from "express";
import * as common from "oci-common";
import * as aispeech from "oci-aispeech";
import bodyParser from "body-parser";
import cors from "cors";
import * as fs from "fs";
import * as path from "path";

const app = express();
const port = 8450;

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://localhost:3001', 
    'http://localhost:8081', 
    'http://localhost:8082', 
    'http://localhost:8083', 
    'http://localhost:19006',
    'http://192.168.8.101:8081',  // Android connecting to computer IP
    'http://192.168.8.101:19006', // Android Expo dev server
    /^http:\/\/192\.168\.8\.\d+:\d+$/  // Allow any device in the local network
  ], 
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());
app.use(express.static(__dirname)); // Serve static files

// Load OCI configuration from config file
const loadOCIConfig = () => {
  try {
    // Use path that works from both source and dist directories
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
    const privateKeyPath = path.resolve(__dirname, '..', 'config', config.key_file);
    console.log(`Loading private key from: ${privateKeyPath}`);
    
    if (!fs.existsSync(privateKeyPath)) {
      throw new Error(`Private key file not found at ${privateKeyPath}`);
    }
    
    config.privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    
    // Validate key format
    if (!config.privateKey.includes('PRIVATE KEY')) {
      throw new Error('Private key file does not appear to be in PEM format');
    }
    
    console.log('OCI Configuration loaded successfully');
    console.log(`- User: ${config.user}`);
    console.log(`- Tenancy: ${config.tenancy}`);
    console.log(`- Region: ${config.region}`);
    
    return config;
  } catch (error) {
    console.error('Error loading OCI configuration:', error);
    throw error;
  }
};

// Load configuration
const ociConfig = loadOCIConfig();
const compartmentId = ociConfig.tenancy; // Use tenancy OCID as compartment for now
const region = ociConfig.region;
const configFilePath = path.resolve(__dirname, '..', 'config', 'config.txt');

/**
 * Generates a real-time session token for OCI AI Speech Service
 */
async function getRealtimeToken() {
  try {
    // Initialize OCI authentication provider
    const provider: common.ConfigFileAuthenticationDetailsProvider = 
      new common.ConfigFileAuthenticationDetailsProvider(configFilePath, "DEFAULT");
    provider.setRegion(region);

    // Initialize the Speech client
    const speechClient = new aispeech.AIServiceSpeechClient({ 
      authenticationDetailsProvider: provider 
    });

    // Create token request
    const createRealtimeSessionTokenDetails = {
      compartmentId: compartmentId,
    };

    const createRealtimeSessionTokenRequest: aispeech.requests.CreateRealtimeSessionTokenRequest = {
      createRealtimeSessionTokenDetails: createRealtimeSessionTokenDetails,
    };

    // Generate token
    const createRealtimeSessionTokenResponse = await speechClient.createRealtimeSessionToken(
      createRealtimeSessionTokenRequest
    );

    console.log("Token generated successfully");
    return createRealtimeSessionTokenResponse.realtimeSessionToken;
  } catch (error) {
    console.error("Error generating token:", error);
    throw error;
  }
}

/**
 * Authentication endpoint - generates JWT token for frontend
 */
app.get("/authenticate", async (req, res) => {
  try {
    console.log("Generating new authentication token...");
    const tokenResponse = await getRealtimeToken();
    console.log("Token response:", {
      token: tokenResponse?.token ? tokenResponse.token.substring(0, 20) + "..." : "null",
      sessionId: tokenResponse?.sessionId,
      compartmentId: tokenResponse?.compartmentId
    });
    
    // Return the complete token object (contains token, sessionId, compartmentId)
    res.json(tokenResponse);  } catch (error) {
    console.error("Authentication failed:", error);
    res.status(401).json({ 
      error: error instanceof Error ? error.message : String(error),
      message: "Failed to generate authentication token"
    });
  }
});

/**
 * Region endpoint - returns the configured region
 */
app.get("/region", (req, res) => {
  res.json({ region: region });
});

/**
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    region: region,
    compartmentId: compartmentId
  });
});

/**
 * Configuration info endpoint (for debugging)
 */
app.get("/config", (req, res) => {
  res.json({
    region: region,
    compartmentId: compartmentId,
    hasPrivateKey: !!ociConfig.privateKey,
    user: ociConfig.user,
    tenancy: ociConfig.tenancy
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`OCI Speech Server running at http://0.0.0.0:${port} (accessible from any network interface)`);
  console.log(`Configuration loaded from: ${configFilePath}`);
  console.log(`Region: ${region}`);
  console.log(`Compartment ID: ${compartmentId}`);
  console.log("Available endpoints:");
  console.log("  GET /health - Health check");
  console.log("  GET /authenticate - Get session token");
  console.log("  GET /region - Get configured region");
  console.log("  GET /config - Get configuration info");
});
