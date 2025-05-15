# PerplexitySceneCapture: Comprehensive Guide

## Executive Summary

PerplexitySceneCapture is an innovative AI-powered React Native application that combines real-time camera functionality with advanced image analysis. The app automatically captures images at regular intervals or via voice commands, then leverages Perplexity's AI models to analyze both individual images and relationships between multiple images.

Key capabilities include:
- Square center-frame image capture (automatic or manual)
- Voice-activated capture with custom prompts
- Individual image analysis using Perplexity's sonar-pro model
- Deep multi-image analysis with sonar-deep-research model
- Immediate analysis option for real-time insights
- Voice recognition with error recovery and automatic retries
- Responsive UI that adapts to device orientation
- Efficient image processing optimized for mobile devices

The app integrates camera functionality, speech recognition, and state-of-the-art AI analysis into a smooth, intuitive interface designed for both casual users and professionals requiring detailed scene analysis.

## Detailed Technical Guide

### Core Functionality

#### Image Capture System

The app's image capture system operates in three modes:

1. **Manual Capture**: When you press the center capture button, the app:
   - Takes a square photo centered in the frame
   - Adds it to the capture stack
   - Optionally begins immediate analysis if enabled
   - Implements a 300ms cooldown period to prevent accidental multiple captures

2. **Voice-Activated Capture**: When voice recognition is enabled:
   - The app continuously listens for speech
   - When a phrase is finalized, it captures an image
   - Attaches the spoken text as a "custom prompt" to the image
   - Uses this custom prompt to guide the AI analysis
   - Implements a slightly longer 1.2-second cooldown between captures

3. **Automatic Timed Capture**: (Available in recording mode)
   - Captures images every 5 seconds during active recording
   - Maintains the same focus area and resolution settings

#### Image Processing Pipeline

All captured images go through a sophisticated processing pipeline:

1. **Image Preparation**:
   - Resizes images to max 1024px on the longest side for optimal analysis
   - Converts to appropriate format (JPEG/PNG)
   - Creates base64 encoding for API transmission
   - Handles platform-specific differences (Web/Android/iOS)

2. **Analysis Options**:
   - **Standard Analysis**: Uses Perplexity's `sonar-pro` model to analyze individual images
   - **Deep Analysis**: Uses the more powerful `sonar-deep-research` model to analyze relationships between multiple images
   - **Immediate Analysis**: Automatically sends newly captured images for analysis without user intervention

3. **Result Processing**:
   - Parses AI responses into structured format (title, description, key points, references)
   - Handles citation information from Perplexity's API
   - Falls back gracefully if parsing fails
   - Updates UI state to reflect analysis status

### AI Analysis Technology

#### Individual Image Analysis

The app uses Perplexity's `sonar-pro` model for individual image analysis, which:

- Receives a base64-encoded image and optional custom prompt
- Analyzes the visual content in detail
- Returns structured information including:
  - A descriptive title of what's in the image
  - A comprehensive description (1-3 paragraphs)
  - Key points of interest (3-5 bullet points)
  - References/citations when applicable

Technical implementation details:
- Non-blocking asynchronous processing to maintain UI responsiveness
- Automatic retry logic for API failures
- Fallback parsing for unexpected response formats
- Custom prompt integration that guides the AI's analysis focus

#### Deep Multi-Image Analysis

For analyzing relationships between multiple images, the app uses Perplexity's `sonar-deep-research` model, which:

- Accepts multiple images simultaneously (optimal: 2-5 images)
- Considers previous individual analyses as context
- Analyzes connections, patterns, and relationships
- Responds to specific user prompts about the collection
- Returns a comprehensive analysis with the same structured format

Technical advantages:
- Higher token limit (1500) for more detailed responses
- Advanced contextual understanding between images
- Ability to identify chronological development, comparative elements, and thematic connections
- Integration of previous analyses to build on existing knowledge

### Voice Recognition System

The voice recognition system is designed for hands-free operation with several advanced features:

1. **Continuous Listening**: When activated, listens for speech without requiring button presses

2. **Automatic Recovery**:
   - Monitors for speech activity and automatically restarts if stuck
   - Implements up to 3 automatic retries if no activity is detected for 20+ seconds
   - Alerts user after 5 consecutive errors with options to restart or disable

3. **Performance Optimization**:
   - Uses a non-blocking architecture to prevent UI freezing
   - Implements request queuing for rapid speech commands
   - Updates volume visualization in real-time based on speech amplitude

4. **Platform Compatibility**:
   - Handles platform-specific microphone access requirements
   - Includes special handling for Android device variations
   - Provides diagnostics for troubleshooting microphone issues

### Technical Implementation Details

#### Image Processing

Images are prepared for analysis using a sophisticated process:
```javascript
// Images are resized to optimal dimensions
if (maxDimension > 1024) {
  const scale = 1024 / maxDimension;
  resizedImage = await manipulateAsync(
    imageUri,
    [{ resize: { width: Math.round(width * scale), height: Math.round(height * scale) } }],
    { format: SaveFormat.JPEG, compress: 0.8 }
  ).then(result => result.uri);
}

// Platform-specific base64 encoding
if (Platform.OS === 'web') {
  base64 = await fetchImageAsBase64(resizedImage);
} else {
  base64 = await FileSystem.readAsStringAsync(resizedImage, {
    encoding: FileSystem.EncodingType.Base64
  });
}
```

#### API Integration

The app communicates with Perplexity API using structured requests:
```javascript
const payload = {
  model: "sonar-pro", // Or "sonar-deep-research" for multi-image analysis
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

// API request with proper authentication
const response = await fetch(API_URL, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  body: JSON.stringify(payload)
});
```

#### Response Parsing

The app implements sophisticated parsing to handle AI responses:
```javascript
// Extract structured data from text responses
const parsedAnalysis = {
  title: cleanText.match(/Title: (.*?)(?:\n|$)/i)?.[1] || "Analysis Results",
  description: cleanText.match(/Description: (.*?)(?:\nKey Points|\n\n|$)/is)?.[1]?.trim() || "",
  keyPoints: keyPointsSection
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('-') || line.startsWith('•'))
    .map(line => line.replace(/^[-•*]\s*/, '')),
  reference: cleanText.match(/Reference: (.*?)(?:\n|$)/i)?.[1] || "Source: Perplexity AI analysis",
  citations: topCitations
};
```

## Advanced Features

### Deep Analysis Capabilities

The deep analysis functionality enables advanced multi-image interpretation:

1. **Custom Prompting**: Users can provide specific questions or directions:
   - "Compare the architectural styles in these buildings"
   - "Identify the chronological development in these historical artifacts"
   - "Find the common botanical characteristics across these plant specimens"
   - "Analyze the emotional expressions in these portrait photos"

2. **Context Preservation**: The system maintains context between analyses:
   ```javascript
   // Previous analysis results are included in new requests
   let previousAnalysisText = "";
   images.forEach((image, index) => {
     if (image.analyzed && image.analysis) {
       hasPreviousAnalysis = true;
       const analysis = image.analysis;
       previousAnalysisText += `\n--- Analysis for Image ${index + 1} ---\n
       Title: ${analysis.title || 'N/A'}\n
       Description: ${analysis.description || 'N/A'}\n
       Key Points: ${analysis.keyPoints ? analysis.keyPoints.map(p => `- ${p}`).join('\n') : 'N/A'}\n
       -----------------------------\n`;
     }
   });
   ```

3. **Enhanced Model Capabilities**: The deep research model provides:
   - Higher quality associations between images
   - More nuanced understanding of connections
   - Better handling of complex, multi-part queries
   - Support for abstract concepts (style, emotion, historical context)

### Performance Optimizations

The app implements several optimizations for mobile environments:

1. **Image Processing**:
   - Automatic image resizing to reduce memory usage and API transmission size
   - Format conversion for optimal compression
   - Platform-specific image handling for best performance

2. **Asynchronous Operations**:
   - Non-blocking architecture prevents UI freezing during capture and analysis
   - Background processing for compute-intensive operations
   - Request queuing to prevent overloading the device or API

3. **Memory Management**:
   - Efficient image storage and cleanup
   - Automatic removal of oldest images when reaching capacity limits
   - Optimization of large data structures

4. **Error Recovery**:
   - Comprehensive error handling for network issues
   - Automatic retry for transient failures
   - Graceful fallbacks when services are unavailable

## Best Practices and Tips

### For Optimal Image Capture

1. **Lighting Considerations**:
   - Ensure even lighting across subjects for best analysis results
   - Avoid backlighting that creates silhouettes
   - For detailed analysis of objects, use diffused lighting to reduce harsh shadows

2. **Framing Techniques**:
   - Center the main subject in the frame (the app captures the center square)
   - For multiple objects, ensure all are visible within the capture area
   - Maintain appropriate distance based on subject size

3. **Stability Factors**:
   - Hold the device steady during capture
   - For detailed analysis of small objects, consider using a tripod
   - Allow auto-focus to complete before capturing

### For Effective Voice Commands

1. **Optimal Phrasing**:
   - Be specific and descriptive in your commands
   - Include key details you want the AI to focus on
   - Use complete sentences rather than single words

2. **Examples of Effective Voice Prompts**:
   - "Analyze this Renaissance painting focusing on the composition and symbolism"
   - "Identify this bird species and provide habitat information"
   - "Examine this historical document and summarize its significance"
   - "Analyze the nutritional content of this food item"

3. **Environmental Considerations**:
   - Reduce background noise for better speech recognition
   - Speak at a normal volume and pace
   - Position the device microphone towards your voice

### For Deep Analysis

1. **Image Selection Strategies**:
   - Group 2-5 related images for optimal results
   - Select images that share common elements but have meaningful differences
   - Consider chronological sequences when appropriate

2. **Prompt Engineering**:
   - Be specific about what connections you're looking for
   - Phrase questions to guide the analysis direction
   - Include any necessary context the AI might not have

3. **Examples of Effective Deep Analysis Prompts**:
   - "Compare the architectural elements in these buildings and identify the time periods they represent"
   - "Analyze these landscape photos and explain how the ecosystem has changed over time"
   - "Examine these product photos and provide a comparative analysis of design evolution"
   - "Identify the common artistic techniques used across these paintings"

## Technical Limitations and Considerations

1. **API Rate Limits and Quotas**:
   - The Perplexity API has usage limits that could affect heavy users
   - Analysis is performed sequentially with delays to avoid rate limiting

2. **Device-Specific Considerations**:
   - Performance may vary based on device processing power
   - Older devices may experience longer processing times
   - Memory constraints may limit the number of stored images

3. **Network Requirements**:
   - Analysis requires internet connectivity
   - Performance depends on network speed and stability
   - Large images may require substantial data transfer

4. **Privacy Considerations**:
   - Images are transmitted to the Perplexity API for analysis
   - The app does not permanently store images on remote servers
   - Consider sensitivity of captured content

## Troubleshooting Common Issues

### Camera Issues

1. **Camera Not Initializing**:
   - Ensure camera permissions are granted
   - Restart the app if camera appears frozen
   - Check if another app is currently using the camera

2. **Blurry Images**:
   - Clean the camera lens
   - Ensure proper lighting
   - Hold the device steady during capture
   - Allow auto-focus to complete before capturing

### Analysis Issues

1. **Analysis Taking Too Long**:
   - Check your internet connection
   - Reduce image resolution if possible
   - Try analyzing fewer images at once

2. **Inaccurate Analysis Results**:
   - Ensure the subject is clearly visible
   - Provide more specific voice prompts
   - Check if the image has good lighting and clarity

### Voice Recognition Issues

1. **Voice Commands Not Recognized**:
   - Check microphone permissions
   - Speak clearly and at a normal volume
   - Reduce background noise
   - For Android devices, see specific troubleshooting in the README

2. **Voice Recognition Stops Working**:
   - Toggle the voice button off and on
   - Restart the app if issues persist
   - Check for system-level microphone restrictions

## Future Development Roadmap

Planned enhancements for the PerplexitySceneCapture app include:

1. **Offline Mode**:
   - Capture now, analyze later functionality
   - Cached analysis for previously analyzed images

2. **Enhanced Analysis Options**:
   - Specialized analysis modes (medical, botanical, architectural)
   - Customizable analysis parameters
   - User-trainable recognition for specific objects

3. **Integration Capabilities**:
   - Export to PDF reports
   - Cloud storage integration
   - Collaborative analysis sharing

4. **Advanced Camera Features**:
   - Night mode capture
   - Enhanced zoom capabilities
   - Object tracking

5. **AI Enhancements**:
   - More detailed analysis with newer models
   - Enhanced contextual understanding
   - Improved multi-image relationship detection
