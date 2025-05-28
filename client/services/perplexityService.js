import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { analysisQueue, PRIORITY } from './analysisQueue';
import { getServerUrlWithOverride } from '../config/serverConfig';

// Get server URL for secure API calls
const SERVER_URL = getServerUrlWithOverride();
const ANALYZE_URL = `${SERVER_URL}/api/perplexity/analyze`;
const ANALYZE_BATCH_URL = `${SERVER_URL}/api/perplexity/analyze-batch`;
const DEEP_ANALYZE_URL = `${SERVER_URL}/api/perplexity/deep-analyze`;

// Server-side validation - no client-side API key needed
const validateServerConnection = async () => {
  try {
    const response = await fetch(`${SERVER_URL}/health`);
    if (!response.ok) {
      throw new Error(`Server not available: ${response.status}`);
    }
    console.log('✅ Server connection validated for Perplexity API');
    return true;
  } catch (error) {
    console.error('❌ Server connection failed:', error.message);
    throw new Error('Perplexity analysis service unavailable. Please check server connection.');
  }
};

// Validate server connection on service initialization
validateServerConnection().catch(error => {
  console.error('Perplexity service initialization warning:', error.message);
});

const analysisEventHandlers = {
  onAnalysisStart: null,
  onAnalysisComplete: null,
  onAnalysisProgress: null,
  onImageAnalyzed: null,
  onError: null
};

export const registerAnalysisEventHandlers = (handlers = {}) => {
  Object.assign(analysisEventHandlers, handlers);
};

/**
 * Processes images through Perplexity API for analysis
 * @param {Array} images - Array of image objects to analyze
 * @param {number} priority - Priority level of the analysis (use PRIORITY constants)
 * @returns {Promise<Array>} - Array of images with analysis data
 */
export const analyzeImages = async (images, priority = PRIORITY.NORMAL) => {
  try {
    // Input validation
    if (!Array.isArray(images)) {
      throw new Error('Images parameter must be an array');
    }
    
    if (images.length === 0) {
      return [];
    }
    
    // Validate server connection before processing
    await validateServerConnection();
    
    // CRITICAL: Use a copy of images to avoid modifying the original array
    const imagesSnapshot = [...images];
    
    // Filter images that haven't been analyzed yet
    const unanalyzedImages = imagesSnapshot.filter(img => img && !img.analyzed);
    
    if (unanalyzedImages.length === 0) {
      return imagesSnapshot;
    }
    
    // Notify that analysis is starting
    if (analysisEventHandlers.onAnalysisStart) {
      analysisEventHandlers.onAnalysisStart(unanalyzedImages.length);
    }
    
    // Track failed analyses to handle them properly
    const failedAnalyses = [];
    // Track successfully processed images
    const processedImages = [];
    
    // Create batches of images to process
    const imageBatches = [];
    // Process smaller batches (5 at a time) for more reliability
    const RELIABLE_BATCH_SIZE = 5;
    for (let i = 0; i < unanalyzedImages.length; i += RELIABLE_BATCH_SIZE) {
      imageBatches.push(unanalyzedImages.slice(i, i + RELIABLE_BATCH_SIZE));
    }
    
    // Process each batch sequentially to avoid overwhelming the queue
    for (let batchIndex = 0; batchIndex < imageBatches.length; batchIndex++) {
      const batch = imageBatches[batchIndex];
      
      // Add delay between batches to avoid rate limiting
      if (batchIndex > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      try {
        // Prepare all images in batch
        const preparedBatch = await Promise.all(
          batch.map(async (image) => {
            return {
              image,
              base64Image: await prepareImageForUpload(image.uri),
              customPrompt: image.customPrompt || ""
            };
          })
        );
        
        // Extract base64 images and prompts for batch API call
        const base64Images = preparedBatch.map(item => item.base64Image);
        const customPrompts = preparedBatch.map(item => item.customPrompt);
        
        // Send all images in batch to Perplexity API at once through the server
        const batchAnalysisResults = await sendToPerplexityAPI(base64Images, customPrompts);
        
        // Process batch results and update images
        preparedBatch.forEach((item, index) => {
          const result = batchAnalysisResults[index];
          
          // Use parsed data from server if available, otherwise use raw data
          const analysis = result.parsed || {
            title: "Analysis Failed",
            description: "Failed to parse analysis results",
            keyPoints: ["Server returned invalid data"],
            reference: "N/A"
          };
          
          const analyzedImage = {
            ...item.image,
            analyzed: true,
            analysis: analysis,
            analysisDate: new Date().toISOString()
          };
          
          // Notify that an image was analyzed
          if (analysisEventHandlers.onImageAnalyzed) {
            analysisEventHandlers.onImageAnalyzed(analyzedImage);
          }
          
          // Add to processed list
          processedImages.push(analyzedImage);
        });
      } catch (error) {
        console.error(`Failed to analyze batch:`, error);
        
        // Mark all images in batch as failed
        batch.forEach(image => {
          // Mark image as failed but NOT analyzed
          const failedImage = {
            ...image,
            analyzed: false,
            failedReason: error.message || "Unknown error"
          };
          
          // Track failed analyses
          failedAnalyses.push(failedImage);
          
          // Notify error handler
          if (analysisEventHandlers.onError) {
            analysisEventHandlers.onError(error, failedImage);
          }
        });
      }
    }
    
    // After all processing is done, call the completion handler
    if (analysisEventHandlers.onAnalysisComplete) {
      // Send processed images and failures
      analysisEventHandlers.onAnalysisComplete(processedImages, failedAnalyses);
    }
    
    // Return the original images array for consistency
    return imagesSnapshot;
    
  } catch (error) {
    console.error('Error in analyzeImages:', error);
    
    // Notify error handler
    if (analysisEventHandlers.onError) {
      analysisEventHandlers.onError(error);
    }
    
    return images; // Return original images if something goes wrong
  }
};

/**
 * Prepares an image for API upload by resizing and converting to base64
 * @param {string} imageUri - URI of the image to prepare
 * @returns {Promise<string>} - Base64 encoded image data URI
 */
const prepareImageForUpload = async (imageUri) => {
  try {
    // For web, handle data URIs directly
    if (Platform.OS === 'web' && imageUri.startsWith('data:')) {
      return imageUri; // Already a data URI, no need to process
    }
    
    // Resize image to maximum 1024px on longest side
    const { width, height } = await getImageDimensions(imageUri);
    const maxDimension = Math.max(width, height);
    
    let resizedImage = imageUri;
    
    if (maxDimension > 1024) {
      const scale = 1024 / maxDimension;
      resizedImage = await manipulateAsync(
        imageUri,
        [
          { resize: { width: Math.round(width * scale), height: Math.round(height * scale) } }
        ],
        { format: SaveFormat.JPEG, compress: 0.8 }
      ).then(result => result.uri);
    }
    
    // Convert to base64
    let base64;
    
    if (Platform.OS === 'web') {
      // Handle web platform
      base64 = await fetchImageAsBase64(resizedImage);
    } else {
      // Handle native platforms
      base64 = await FileSystem.readAsStringAsync(resizedImage, {
        encoding: FileSystem.EncodingType.Base64
      });
    }
    
    // Form the data URI
    const imageType = imageUri.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return `data:${imageType};base64,${base64}`;
    
  } catch (error) {
    console.error('Error preparing image:', error);
    throw error;
  }
};

/**
 * Get image dimensions
 * @param {string} uri - Image URI
 * @returns {Promise<{width: number, height: number}>} - Image dimensions
 */
const getImageDimensions = async (uri) => {
  try {
    // For data URIs on web, create an Image element to get dimensions
    if (Platform.OS === 'web' && uri.startsWith('data:')) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          resolve({ width: img.width, height: img.height });
        };
        img.onerror = reject;
        img.src = uri;
      });
    }
    
    if (Platform.OS === 'web') {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          resolve({ width: img.width, height: img.height });
        };
        img.onerror = (e) => {
          console.error('Error loading image for dimensions:', e);
          reject(e);
        };
        // Add CORS handling for web
        img.crossOrigin = 'Anonymous';
        img.src = uri;
      });
    } else {
      // For Android and iOS, use manipulateAsync to get image info
      // This is more reliable than Image.getSize
      const info = await manipulateAsync(
        uri,
        [], // No operations, just get info
        { format: SaveFormat.JPEG }
      );
      return { width: info.width, height: info.height };
    }
  } catch (error) {
    console.error('Error getting image dimensions:', error);
    // Return fallback dimensions if we can't determine them
    return { width: 1024, height: 1024 };
  }
};

/**
 * Fetch image and convert to base64 (for web)
 * @param {string} uri - Image URI
 * @returns {Promise<string>} - Base64 encoded image
 */
const fetchImageAsBase64 = async (uri) => {
  // Handle data URIs directly
  if (uri.startsWith('data:')) {
    const base64data = uri.split(',')[1];
    return base64data;
  }
  
  try {
    const response = await fetch(uri, {
      mode: 'cors', // Add CORS mode for web compatibility
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result.split(',')[1];
        resolve(base64data);
      };
      reader.onerror = (e) => {
        console.error('Error reading file:', e);
        reject(e);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error fetching image as base64:', error);
    throw error;
  }
};

/**
 * Send prepared images to Perplexity API through server proxy and get analysis
 * @param {string|Array<string>} base64Images - Single Base64 encoded image data URI or array of them
 * @param {string|Array<string>} userPrompts - Optional user prompt(s) for additional context
 * @returns {Promise<object|Array<object>>} - Analysis results for single or multiple images
 */
const sendToPerplexityAPI = async (base64Images, userPrompts = "") => {
  try {
    // Handle single image case for backward compatibility
    const isMultipleImages = Array.isArray(base64Images);
    
    if (isMultipleImages) {
      // Use batch endpoint for multiple images
      const response = await fetch(ANALYZE_BATCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          base64Images: base64Images,
          userPrompts: Array.isArray(userPrompts) ? userPrompts : [userPrompts]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }

      const data = await response.json();
      return data.results;
      
    } else {
      // Use single image endpoint for individual analysis
      const userPrompt = Array.isArray(userPrompts) ? userPrompts[0] || "" : userPrompts;
      
      const response = await fetch(ANALYZE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          base64Image: base64Images,
          userPrompt: userPrompt
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }

      const data = await response.json();
      return data;
    }
    
  } catch (error) {
    console.error('Secure Perplexity API error:', error);
    
    const errorAnalysis = {
      error: true,
      message: error.message,
      parsed: {
        title: "Analysis Failed",
        description: "There was an error analyzing this image.",
        keyPoints: ["Server error occurred", `Error: ${error.message}`],
        reference: "N/A"
      }
    };
    
    // Return single error or array of errors based on input type
    return Array.isArray(base64Images) ? 
      Array(base64Images.length).fill(errorAnalysis) : errorAnalysis;
  }
};

/**
 * Performs deep analysis on multiple images using the sonar-deep-research model
 * @param {Array} images - Array of image objects to analyze together
 * @param {string} userPrompt - Custom prompt from the user
 * @returns {Promise<object>} - Analysis results
 */
export const performDeepAnalysis = async (images, userPrompt = "") => {
  try {
    // Prepare all images as base64
    const imagePromises = images.map(image => prepareImageForUpload(image.uri));
    const base64Images = await Promise.all(imagePromises);
    
    // Prepare previous analysis results text - only include if analysis exists
    let previousAnalysisText = "";
    let hasPreviousAnalysis = false;
    images.forEach((image, index) => {
      if (image.analyzed && image.analysis) {
        hasPreviousAnalysis = true; // Mark that we have at least one analysis
        const analysis = image.analysis;
        previousAnalysisText += `\n        --- Analysis for Image ${index + 1} ---\n        Title: ${analysis.title || 'N/A'}\n        Description: ${analysis.description || 'N/A'}\n        Key Points: ${analysis.keyPoints ? analysis.keyPoints.map(p => `- ${p}`).join('\n') : 'N/A'}\n        -----------------------------\n        `;
      }
    });

    // Use secure server endpoint for deep analysis
    const response = await fetch(DEEP_ANALYZE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        base64Images: base64Images,
        userPrompt: userPrompt,
        previousAnalysisText: hasPreviousAnalysis ? previousAnalysisText : ""
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Server error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Use the parsed data from the server
    const parsedAnalysis = data.parsed || {
      title: "Deep Analysis Failed",
      description: "Failed to parse analysis results",
      keyPoints: ["Server returned invalid data"],
      reference: "N/A"
    };
    
    // Add metadata about this analysis
    return {
      ...parsedAnalysis,
      timestamp: new Date().toISOString(),
      imageCount: images.length,
      customPrompt: userPrompt || null,
      images: images // Include the original images for context
    };
    
  } catch (error) {
    console.error('Deep Analysis error:', error);
    return {
      title: "Deep Analysis Failed",
      description: "There was an error analyzing these images together.",
      keyPoints: ["API error occurred", `Error: ${error.message}`],
      reference: "N/A",
      timestamp: new Date().toISOString(),
      error: true
    };
  }
};
