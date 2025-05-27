import express from "express";
import * as common from "oci-common";
import * as aispeech from "oci-aispeech";
import bodyParser from "body-parser";
import cors from "cors";
import * as fs from "fs";
import * as path from "path";
import { loadOCIConfig, hasPlaceholderValues } from "./utils/config";

const app = express();
const port = Number(process.env.PORT) || 8450;

// CORS configuration - Updated for production
const allowedOrigins = [
  'http://localhost:3000', 
  'http://localhost:3001', 
  'http://localhost:8081', 
  'http://localhost:8082', 
  'http://localhost:8083', 
  'http://localhost:19006',
  'http://192.168.8.101:8081',
  'http://192.168.8.101:19006',
  /^http:\/\/192\.168\.8\.\d+:\d+$/,
  // Add production domains
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ...(process.env.PRODUCTION_DOMAIN ? [process.env.PRODUCTION_DOMAIN] : [])
];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(__dirname)); // Serve static files

// Initialize OCI configuration with security checks
let ociConfig: any;
try {
  ociConfig = loadOCIConfig();
  
  // Check for placeholder values in production
  if (hasPlaceholderValues(ociConfig)) {
    console.error('ERROR: Configuration contains placeholder values!');
    console.error('Please set proper values in environment variables or config file.');
    process.exit(1);
  }
  
  console.log('OCI Configuration loaded successfully');
  console.log(`- User: ${ociConfig.user}`);
  console.log(`- Tenancy: ${ociConfig.tenancy}`);
  console.log(`- Region: ${ociConfig.region}`);
} catch (error) {
  console.error('Failed to load OCI configuration:', error);
  process.exit(1);
}

// Configuration constants
const compartmentId = ociConfig.tenancy; // Use tenancy OCID as compartment for now
const region = ociConfig.region;

/**
 * Generates a real-time session token for OCI AI Speech Service
 */
async function getRealtimeToken() {
  try {
    // Initialize OCI authentication provider using secure config
    const provider = new common.SimpleAuthenticationDetailsProvider(
      ociConfig.tenancy,
      ociConfig.user,
      ociConfig.fingerprint,
      ociConfig.privateKey,
      null, // passphrase (null if key is not encrypted)
      common.Region.fromRegionId(ociConfig.region)
    );

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
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    oci: {
      configured: !!ociConfig.privateKey,
      region: region
    }
  });
});

/**
 * Server info endpoint
 */
app.get("/info", (req, res) => {
  res.json({
    name: "OCI Speech Server",
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
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
  console.log(`🚀 OCI Speech Server running at http://0.0.0.0:${port}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌍 Region: ${region}`);
  console.log(`📁 Compartment ID: ${compartmentId}`);
  console.log("📋 Available endpoints:");
  console.log("  GET /health - Health check");
  console.log("  GET /info - Server information");
  console.log("  GET /authenticate - Get session token");
  console.log("  GET /region - Get configured region");
  console.log("  GET /config - Get configuration info");
    // Log startup warnings
  if (hasPlaceholderValues(ociConfig)) {
    console.warn("⚠️  WARNING: Some configuration values appear to be placeholders!");
    console.warn("⚠️  Please update your OCI configuration before production use.");
  }
  
  if (process.env.NODE_ENV === 'production') {
    console.log("✅ Production mode enabled");
  } else {
    console.log("🔧 Development mode enabled");
  }
});
