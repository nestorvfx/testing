import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// Constants for API interaction
const API_URL = 'https://api.perplexity.ai/chat/completions';
const API_KEY = '***REMOVED***'; // Replace with your actual API key

/**
 * Processes images through Perplexity API for analysis
 * @param {Array} images - Array of image objects to analyze
 * @returns {Promise<Array>} - Array of images with analysis data
 */
export const analyzeImages = async (images) => {
  try {
    // Filter images that haven't been analyzed yet
    const unanalyzedImages = images.filter(img => !img.analyzed);
    
    if (unanalyzedImages.length === 0) {
      console.log('No new images to analyze');
      return images;
    }
    
    console.log(`Analyzing ${unanalyzedImages.length} images...`);
    
    // Process each image in sequence to avoid rate limits
    const results = await Promise.all(
      unanalyzedImages.map(async (image, index) => {
        // Add a delay between requests if processing multiple images
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        try {
          const base64Image = await prepareImageForUpload(image.uri);
          const analysis = await sendToPerplexityAPI(base64Image);
          
          // Return updated image object with analysis data
          return {
            ...image,
            analyzed: true,
            analysis: analysis,
            analysisDate: new Date().toISOString()
          };
        } catch (error) {
          console.error(`Failed to analyze image ${index}:`, error);
          return image; // Return original image if analysis fails
        }
      })
    );
    
    // Merge analyzed images with existing ones
    return images.map(img => {
      const updatedImg = results.find(result => result.uri === img.uri);
      return updatedImg || img;
    });
    
  } catch (error) {
    console.error('Error in analyzeImages:', error);
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
  return new Promise((resolve, reject) => {
    if (Platform.OS === 'web') {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = reject;
      img.src = uri;
    } else {
      Image.getSize(uri, 
        (width, height) => resolve({ width, height }), 
        reject
      );
    }
  });
};

/**
 * Fetch image and convert to base64 (for web)
 * @param {string} uri - Image URI
 * @returns {Promise<string>} - Base64 encoded image
 */
const fetchImageAsBase64 = async (uri) => {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result.split(',')[1];
      resolve(base64data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Send prepared image to Perplexity API and get analysis
 * @param {string} base64Image - Base64 encoded image data URI
 * @returns {Promise<object>} - Analysis results
 */
const sendToPerplexityAPI = async (base64Image) => {
  try {
    const prompt = `You are given a series of photos. For each photo, follow these steps:

Examine the photo to identify the main subject or the most recognizable entity, such as a famous person, a landmark, or a notable object.

Research the web to gather detailed information about the identified subject.

Present your findings in the following structured format:

Title: [A concise title that describes the main subject]
Description: [A brief paragraph providing an overview of the subject]
Key Points:
- [Important fact or detail 1]
- [Important fact or detail 2]
- [Important fact or detail 3]
- [Add more key points as necessary]
Reference: [At least one reference or source for the information]

Note: If there are multiple notable elements in the photo, focus on the one that appears to be the primary subject or the most prominent or if they as a group make sense look up like that`;

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

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    
    // Log the raw API response for debugging
    console.log('=== PERPLEXITY API RESPONSE START ===');
    console.log('Status:', response.status);
    console.log('Headers:', JSON.stringify(Object.fromEntries([...response.headers.entries()]), null, 2));
    console.log('Response data:', JSON.stringify(data, null, 2));
    console.log('=== PERPLEXITY API RESPONSE END ===');
    
    const analysisText = data.choices[0].message.content;
    console.log('Raw analysis text:', analysisText);

    // Get citations from the response
    const citations = data.citations || [];
    console.log('Citations:', citations);

    // Parse the structured analysis, passing citations
    const parsedAnalysis = parseAnalysisText(analysisText, citations);
    
    // Log the final parsed analysis
    console.log('Parsed analysis result:', JSON.stringify(parsedAnalysis, null, 2));
    
    return parsedAnalysis;
    
  } catch (error) {
    console.error('Perplexity API error:', error);
    return {
      title: "Analysis Failed",
      description: "There was an error analyzing this image.",
      keyPoints: ["API error occurred", `Error: ${error.message}`],
      reference: "N/A"
    };
  }
};

/**
 * Parse the text analysis into structured data
 * @param {string} text - Raw analysis text
 * @param {Array} citations - Array of citation URLs from API response
 * @returns {object} - Structured analysis data
 */
const parseAnalysisText = (text, citations = []) => {
  try {
    // Remove citation markers like [1][2] from the text
    const cleanText = text.replace(/\[\d+\]/g, '');
    
    // Simple parsing of the expected format
    const title = cleanText.match(/Title: (.*?)(?:\n|$)/)?.[1] || 
                 cleanText.match(/# Title: (.*?)(?:\n|$)/)?.[1] || "Unknown";
                 
    const description = cleanText.match(/Description: (.*?)(?:\nKey Points|\n\n|$)/s)?.[1]?.trim() || 
                       cleanText.match(/## Description\n(.*?)(?:\n##|\n\n|$)/s)?.[1]?.trim() || "";
    
    // Extract key points as an array
    const keyPointsSection = cleanText.match(/Key Points:(.*?)(?:\nReference:|\n\n|$)/s)?.[1] || 
                            cleanText.match(/## Key Points:?\n(.*?)(?:\n##|\n\n|$)/s)?.[1] || "";
    const keyPoints = keyPointsSection
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('-') || line.startsWith('•'))
      .map(line => line.replace(/^[-•]\s*/, ''))
      .filter(Boolean);
    
    // Get base reference text
    let referenceText = cleanText.match(/Reference: (.*?)(?:\n|$)/)?.[1] || 
                       cleanText.match(/## References?\n(.*?)(?:\n##|\n\n|$)/s)?.[1]?.trim() || 
                       "Sources";
    
    // Take just the top 2 citations for the references
    const topCitations = citations.slice(0, 2);
    
    // Format citations for display
    let referencesFormatted = referenceText;
    if (topCitations.length > 0) {
      // We'll provide both the text reference and the structured citation URLs
      referencesFormatted = referenceText;
    }
    
    const result = {
      title,
      description,
      keyPoints,
      reference: referencesFormatted,
      citations: topCitations // Just include top 2 citations
    };
    
    return result;
  } catch (error) {
    console.error('Error parsing analysis text:', error);
    return {
      title: "Analysis Result",
      description: text.substring(0, 200) + "...",
      keyPoints: [],
      reference: "N/A",
      citations: []
    };
  }
};
