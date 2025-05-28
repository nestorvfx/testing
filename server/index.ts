import express, { Request, Response } from "express";
import * as common from "oci-common";
import * as aispeech from "oci-aispeech";
import bodyParser from "body-parser";
import cors from "cors";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { loadOCIConfig, hasPlaceholderValues } from "./utils/config";

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 8450;

// Perplexity API configuration
const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
const perplexityApiUrl = process.env.PERPLEXITY_API_URL || 'https://api.perplexity.ai/chat/completions';

// Validate Perplexity API configuration
const validatePerplexityConfig = () => {
  if (!perplexityApiKey || perplexityApiKey === 'your_perplexity_api_key_here') {
    console.warn('⚠️  WARNING: Perplexity API key not configured. Analysis features will be disabled.');
    return false;
  }
  
  if (!perplexityApiKey.startsWith('pplx-')) {
    console.warn('⚠️  WARNING: Invalid Perplexity API key format. Key should start with "pplx-"');
    return false;
  }
  
  console.log('✅ Perplexity API configuration loaded successfully');
  return true;
};

const perplexityEnabled = validatePerplexityConfig();

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
  ...(process.env.PRODUCTION_DOMAIN ? [process.env.PRODUCTION_DOMAIN] : []),
  // Allow any HTTP/HTTPS origin for production mobile apps
  /^https?:\/\/.+$/
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
app.get("/authenticate", async (req: Request, res: Response) => {
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
app.get("/region", (req: Request, res: Response) => {
  res.json({ region: region });
});

/**
 * Health check endpoint
 */
app.get("/health", (req: Request, res: Response) => {
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
app.get("/info", (req: Request, res: Response) => {
  res.json({
    name: "OCI Speech Server",
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

/**
 * Perplexity API Proxy Endpoints
 * These endpoints provide secure access to Perplexity API without exposing the API key to clients
 */

/**
 * Single image analysis endpoint
 */
app.post("/api/perplexity/analyze", async (req: Request, res: Response) => {
  if (!perplexityEnabled) {
    return res.status(503).json({
      error: "Perplexity API not configured",
      message: "Analysis service is not available"
    });
  }

  try {
    const { base64Image, userPrompt = "" } = req.body;

    if (!base64Image) {
      return res.status(400).json({
        error: "Missing required field",
        message: "base64Image is required"
      });
    }

    const prompt = userPrompt ? 
      `${userPrompt}\n\nPlease examine this image and provide insights about it. Structure your response with a title, description, and key points.` : 
      `Examine this image and identify the main subject or notable elements. Provide detailed information in the following format:
      
      Title: [A concise title describing the main subject]
      Description: [A comprehensive overview of what's shown]
      Key Points:
      - [Important fact or detail 1]
      - [Important fact or detail 2]
      - [Important fact or detail 3]
      - [Add more key points as necessary]
      Reference: [Sources for your information]`;

    const payload = {
      model: "sonar-pro",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: base64Image } }
          ]
        }
      ],
      stream: false
    };

    const response = await fetch(perplexityApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Perplexity API error (${response.status}):`, errorText);
      return res.status(response.status).json({
        error: "Perplexity API error",
        message: `API request failed: ${response.status}`
      });
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('Error in Perplexity analysis:', error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to process analysis request"
    });
  }
});

/**
 * Batch image analysis endpoint
 */
app.post("/api/perplexity/analyze-batch", async (req: Request, res: Response) => {
  if (!perplexityEnabled) {
    return res.status(503).json({
      error: "Perplexity API not configured",
      message: "Analysis service is not available"
    });
  }

  try {
    const { base64Images, userPrompts = [] } = req.body;

    if (!Array.isArray(base64Images) || base64Images.length === 0) {
      return res.status(400).json({
        error: "Invalid input",
        message: "base64Images must be a non-empty array"
      });
    }

    if (base64Images.length > 10) {
      return res.status(400).json({
        error: "Too many images",
        message: "Maximum 10 images allowed per batch"
      });
    }

    // Process each image with rate limiting
    const results = [];
    for (let i = 0; i < base64Images.length; i++) {
      const base64Image = base64Images[i];
      const userPrompt = userPrompts[i] || userPrompts[0] || "";

      // Add delay between requests to avoid rate limiting
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      try {
        const prompt = userPrompt ? 
          `${userPrompt}\n\nPlease examine this image and provide insights about it. Structure your response with a title, description, and key points.` : 
          `Examine this image and identify the main subject or notable elements. Provide detailed information in the following format:
          
          Title: [A concise title describing the main subject]
          Description: [A comprehensive overview of what's shown]
          Key Points:
          - [Important fact or detail 1]
          - [Important fact or detail 2]
          - [Important fact or detail 3]
          - [Add more key points as necessary]
          Reference: [Sources for your information]`;

        const payload = {
          model: "sonar-pro",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: base64Image } }
              ]
            }
          ],
          stream: false
        };        const response = await fetch(perplexityApiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${perplexityApiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        results.push(data);      } catch (error) {
        console.error(`Error analyzing image ${i}:`, error);
        results.push({
          error: true,
          message: error instanceof Error ? error.message : "Analysis failed"
        });
      }
    }

    res.json({ results });

  } catch (error) {
    console.error('Error in batch Perplexity analysis:', error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to process batch analysis request"
    });
  }
});

/**
 * Deep analysis endpoint for multiple images
 */
app.post("/api/perplexity/deep-analyze", async (req: Request, res: Response) => {
  if (!perplexityEnabled) {
    return res.status(503).json({
      error: "Perplexity API not configured",
      message: "Analysis service is not available"
    });
  }
  try {
    const { base64Images, userPrompt = "", previousAnalysisText = null } = req.body;

    if (!Array.isArray(base64Images) || base64Images.length === 0) {
      return res.status(400).json({
        error: "Invalid input",
        message: "base64Images must be a non-empty array"
      });
    }

    if (base64Images.length > 10) {
      return res.status(400).json({
        error: "Too many images",
        message: "Maximum 10 images allowed for deep analysis"
      });
    }

    // Use provided previous analysis text or generate context
    const hasPreviousAnalysis = !!previousAnalysisText;
    
    const analysisContext = hasPreviousAnalysis ? 
      `\n        --- Previous Analysis Results ---${previousAnalysisText}\n        --- End of Previous Analysis ---\n        Guide to follow:\n        You are given a series of photos (provided below) and potentially their previous individual analyses (provided above).\n        Consider all images together as a collection, using any previous analyses as context.\n        Analyze these images and information in combination with the 'Main Task' as a group, looking for patterns, connections, or themes with insightful answer on the given prompt/images.` : 
      `\n        Guide to follow:\n        You are given a series of photos (provided below).\n        Consider all images together as a collection.\n        Analyze these images in order to answer 'Main Prompt' as a group, looking for patterns, connections, or themes with insightful answer on the given prompt/images.`;

    const content = [
      {
        type: "text",
        text: userPrompt ? 
          'Main Prompt (most important): ' + userPrompt + `\n Previous information (use to gain insights in order to complete Main prompt accordingly):\n${analysisContext}` : 
          `Find connection and provide insightful analysis\n${analysisContext}\n\nPresent your findings in the following structured format:\n\nTitle: [A concise title that describes the main theme or connection]\nDescription: [A detailed paragraph providing a comprehensive analysis of what these images represent as a collection, considering both the images and previous analyses]\nKey Points:\n- [Important insight or connection 1]\n- [Important insight or connection 2]\n- [Important insight or connection 3]\n- [Add more key points as necessary]\nReference: [References or sources for your analysis]`
      },
      ...base64Images.map(base64 => ({
        type: "image_url",
        image_url: { url: base64 }
      }))
    ];

    const payload = {
      model: "sonar-deep-research",
      messages: [
        {
          role: "user",
          content: content
        }
      ],
      stream: false,      max_tokens: 1500
    };

    const response = await fetch(perplexityApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Perplexity API error (${response.status}):`, errorText);
      return res.status(response.status).json({
        error: "Perplexity API error",
        message: `API request failed: ${response.status}`
      });
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('Error in deep Perplexity analysis:', error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to process deep analysis request"
    });
  }
});

/**
 * Configuration info endpoint (for debugging)
 */
app.get("/config", (req: Request, res: Response) => {
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
