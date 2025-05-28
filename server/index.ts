import express, { Request, Response } from "express";
import * as common from "oci-common";
import * as aispeech from "oci-aispeech";
import bodyParser from "body-parser";
import cors from "cors";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { loadOCIConfig, hasPlaceholderValues } from "./utils/config";

// Define types for Perplexity API responses
interface PerplexityResponse {
  choices?: {
    message?: {
      content?: string;
    };
  }[];
  citations?: any[];
  parsed?: AnalysisResult;
  error?: boolean;
  message?: string;
}

interface AnalysisResult {
  title: string;
  description: string;
  keyPoints: string[];
  reference: string;
  citations?: any[];
  timestamp?: string;
  imageCount?: number;
  customPrompt?: string | null;
}

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

// CORS configuration - Fixed for production and to prevent multiple headers
const allowedOrigins = [
  'http://localhost:3000', 
  'http://localhost:3001', 
  'http://localhost:8081', 
  'http://localhost:8082', 
  'http://localhost:8083', 
  'http://localhost:19006',
  'http://192.168.8.101:8081',
  'http://192.168.8.101:19006',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ...(process.env.PRODUCTION_DOMAIN ? [process.env.PRODUCTION_DOMAIN] : [])
];

// CORS configuration - Disabled since nginx proxy handles CORS
// app.use(cors({
//   origin: function(origin, callback) {
//     // Allow requests with no origin (like mobile apps or curl requests)
//     if (!origin) return callback(null, true);
//     
//     // For simplicity, use * for all origins in production
//     // This is the safest approach to avoid multiple header issues
//     callback(null, '*');
//   },
//   methods: ['GET', 'POST', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
//   credentials: true
// }));

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
    res.json(tokenResponse);
  } catch (error) {
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

    const data = await response.json() as PerplexityResponse;
    
    // Parse the response into structured format for easier client handling
    const analysisText = data.choices?.[0]?.message?.content || "No analysis available";
    const citations = data.citations || [];
    
    // Add parsed data to the response
    data.parsed = parseAnalysisText(analysisText, citations);
    
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
    const results: PerplexityResponse[] = [];
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
          throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json() as PerplexityResponse;
        
        // Parse the response for easier client handling
        const analysisText = data.choices?.[0]?.message?.content || "No analysis available";
        const citations = data.citations || [];
        data.parsed = parseAnalysisText(analysisText, citations);
        
        results.push(data);
      } catch (error) {
        console.error(`Error analyzing image ${i}:`, error);
        results.push({
          error: true,
          message: error instanceof Error ? error.message : "Analysis failed",
          parsed: {
            title: "Analysis Failed",
            description: "There was an error analyzing this image.",
            keyPoints: ["API error occurred", error instanceof Error ? error.message : "Unknown error"],
            reference: "N/A"
          }
        } as PerplexityResponse);
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
      stream: false,
      max_tokens: 1500
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

    const data = await response.json() as PerplexityResponse;
    
    // Parse the response for easier client handling
    const analysisText = data.choices?.[0]?.message?.content || "No analysis available";
    const citations = data.citations || [];
    data.parsed = parseAnalysisText(analysisText, citations);
    
    // Add metadata
    if (data.parsed) {
      data.parsed.timestamp = new Date().toISOString();
      data.parsed.imageCount = base64Images.length;
      data.parsed.customPrompt = userPrompt || null;
    }
    
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
 * Parse the text analysis into structured data
 * @param {string} text - Raw analysis text
 * @param {Array} citations - Array of citation URLs from API response
 * @returns {object} - Structured analysis data
 */
function parseAnalysisText(text: string, citations: any[] = []): AnalysisResult {
  try {
    // Remove <think> blocks - often included in deep analysis responses
    let cleanText = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    
    // Remove citation markers like [1][2] from the text
    cleanText = cleanText.replace(/\[\d+\]/g, '');
    
    // For markdown formatted headings, convert to standard format
    cleanText = cleanText.replace(/# ([^\n]+)/g, 'Title: $1');
    cleanText = cleanText.replace(/## ([^\n]+)/g, '$1:');
    
    // Extract title - try various patterns
    let title = cleanText.match(/Title: (.*?)(?:\n|$)/i)?.[1] || 
               cleanText.match(/^(.*?)(?:\n|$)/)?.[1] || 
               "Analysis Results";
    
    // If title is too long, it might be part of free-form text - truncate it
    if (title.length > 100) {
      title = title.substring(0, 97) + "...";
    }
    
    // Extract description - try multiple patterns
    let description = cleanText.match(/Description: (.*?)(?:\nKey Points|\n\n|$)/is)?.[1]?.trim() || 
                     cleanText.match(/Description\n(.*?)(?:\nKey Points|\n\n|$)/is)?.[1]?.trim() || 
                     cleanText.match(/^(?:(?!Title|Key Points|Reference).)*$/im)?.[0]?.trim() || "";
    
    // If no description found but we have text, provide a fallback
    if (!description && cleanText.length > 0) {
      const firstParagraph = cleanText.split('\n\n')[0];
      if (firstParagraph && !firstParagraph.includes('Title:')) {
        description = firstParagraph.trim();
      } else {
        // Get first substantial paragraph as description
        const paragraphs = cleanText.split('\n\n').filter((p: string) => 
          p.length > 50 && 
          !p.includes('Title:') && 
          !p.includes('Key Points:') && 
          !p.includes('Reference:')
        );
        description = paragraphs[0] || "Analysis provided by Perplexity AI";
      }
    }
    
    // Extract key points as an array - try multiple patterns
    let keyPointsSection = cleanText.match(/Key Points:(.*?)(?:\nReference:|\n\n|$)/is)?.[1] || 
                          cleanText.match(/Key Points\n(.*?)(?:\nReference:|\n\n|$)/is)?.[1] || "";
    
    let keyPoints: string[] = [];
    if (keyPointsSection) {
      keyPoints = keyPointsSection
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.startsWith('-') || line.startsWith('•') || line.startsWith('*'))
        .map((line: string) => line.replace(/^[-•*]\s*/, ''))
        .filter(Boolean);
    }
    
    // If no key points found but we have paragraph breaks, make paragraphs into key points
    if (keyPoints.length === 0) {
      const potentialPoints = cleanText
        .split('\n\n')
        .filter((p: string) => 
          p.length > 20 && 
          !p.includes('Title:') && 
          !p.includes('Description:') && 
          !p.includes('Key Points:') && 
          !p.includes('Reference:')
        )
        .slice(1); // Skip first paragraph as it's likely the description
        
      if (potentialPoints.length > 0) {
        keyPoints = potentialPoints.map((p: string) => p.replace(/^\s*[-•*]\s*/, '').trim());
      }
    }
    
    // Get reference text or use fallback
    let referenceText = cleanText.match(/Reference: (.*?)(?:\n|$)/i)?.[1] || 
                       cleanText.match(/References\n(.*?)(?:\n##|\n\n|$)/is)?.[1]?.trim() || 
                       "Source: Perplexity AI analysis";
    
    // Take just the top 2 citations for the references
    const topCitations = citations.slice(0, 2);
    
    return {
      title,
      description,
      keyPoints: keyPoints.length > 0 ? keyPoints : generateFallbackKeyPoints(description),
      reference: referenceText,
      citations: topCitations
    };
  } catch (error) {
    console.error('Error parsing analysis text:', error);
    return {
      title: "Analysis Results",
      description: text.substring(0, 200) + (text.length > 200 ? "..." : ""),
      keyPoints: ["The complete analysis is available but couldn't be structured automatically"],
      reference: "Source: Perplexity AI",
      citations: []
    };
  }
}

/**
 * Generate fallback key points from description
 * @param {string} description - Description text
 * @returns {Array} - Array of generated key points
 */
function generateFallbackKeyPoints(description: string): string[] {
  if (!description || description.length < 20) {
    return ["No detailed analysis available"];
  }
  
  // Split into sentences and try to extract 3-5 key points
  const sentences = description.match(/[^.!?]+[.!?]+/g) || [];
  
  if (sentences.length <= 1) {
    return [description];
  } else if (sentences.length <= 3) {
    return sentences.map((s: string) => s.trim());  } else {
    // Pick sentences distributed throughout the text
    const step = Math.floor(sentences.length / 3);
    return [
      sentences[0]?.trim() || "Key point 1",
      sentences[Math.min(step, sentences.length - 1)]?.trim() || "Key point 2",
      sentences[Math.min(2 * step, sentences.length - 1)]?.trim() || "Key point 3"
    ];
  }
}

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

const server = app.listen(port, '0.0.0.0', () => {
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
  console.log("  POST /api/perplexity/analyze - Analyze single image");
  console.log("  POST /api/perplexity/analyze-batch - Analyze multiple images");
  console.log("  POST /api/perplexity/deep-analyze - Analyze image relationships");
  
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

// Configure server timeouts for long-running analysis requests
server.timeout = 600000; // 10 minutes timeout for requests (deep analysis can be slow)
server.keepAliveTimeout = 65000; // Keep connections alive
server.headersTimeout = 66000; // Headers timeout slightly higher than keepAlive
