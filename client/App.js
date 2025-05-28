import './src/utils/crypto-polyfill';
import './polyfills';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Dimensions, Platform, StyleSheet, Alert } from 'react-native';

// Components
import CameraView from './components/camera/CameraView';
import CaptureButton from './components/camera/CaptureButton';
import CardGroup from './components/cards/CardGroup';
import CardStack from './components/cards/CardStack';
import ExpandedCard from './components/cards/ExpandedCard';
import ErrorView from './components/ui/ErrorView';
import AnalyzeButton from './components/ui/AnalyzeButton';
import DeepAnalysisButton from './components/ui/DeepAnalysisButton';
import DeepAnalysisResults from './components/ui/DeepAnalysisResults';
import NewAnalysisPromptModal from './components/ui/NewAnalysisPromptModal';
// Import the new components
import VoiceButton from './components/ui/VoiceButton';
import ImmediateAnalysisButton from './components/ui/ImmediateAnalysisButton';
import SpeechWaveVisualizer from './components/ui/SpeechWaveVisualizer';

// Hooks
import { useCamera } from './hooks/useCamera';
import { usePermissions } from './hooks/usePermissions';
import { useCardStack } from './hooks/useCardStack';

// Services
import { analyzeImages, performDeepAnalysis, registerAnalysisEventHandlers } from './services/perplexityService';
import { PRIORITY } from './services/analysisQueue';

// Styles and constants
import { styles } from './styles';

export default function App() {
  // State for device dimensions
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  
  // Use our custom hooks
  const {
    cameraReady, setCameraReady, isCapturing, cameraError, setCameraError,
    cameraRef, captureButtonScale, capturePhoto
  } = useCamera();
  
  const {
    hasPermission, mediaPermissionOnly, permissionError,
    requestMediaPermissionOnly, retryPermissions
  } = usePermissions();
  
  const {
    captures, addCapture, updateCaptures, isCardsExpanded, expandedCardIndex,
    toggleCardGroup, expandCard, collapseCard, handleOutsideClick, 
    scrollCards, scrollViewRef, cardAnimation, cardGroupBackgroundOpacity, 
    panResponder, cardGroupStyles, expandAnimation
  } = useCardStack(dimensions);

  // Add state for voice recognition and immediate analysis
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [isImmediateAnalysisActive, setIsImmediateAnalysisActive] = useState(false);
  const isImmediateAnalysisActiveRef = useRef(false); // Add ref to track latest value
  
  // Update ref when state changes
  useEffect(() => {
    isImmediateAnalysisActiveRef.current = isImmediateAnalysisActive;
  }, [isImmediateAnalysisActive]);
  
  const [spokenPrompt, setSpokenPrompt] = useState('');
  const [speechVolume, setSpeechVolume] = useState(0); // Add speech volume state for visualizer
  const [displayText, setDisplayText] = useState(''); // Separate state for display text that persists longer
  const speechDisplayTimerRef = useRef(null); // Timer for clearing display text

  // Handle an incoming image and update pending analysis count
  const handleNewImage = useCallback((image) => {
    // Add to captures
    addCapture(image);
    
    // No need to set pendingAnalysisCount manually - it will be calculated from captures and imagesSentForAnalysis
  }, [addCapture]);

  // Add state for analysis tracking
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Add state to track the number of active analysis operations
  const [activeAnalysisCount, setActiveAnalysisCount] = useState(0);
  
  // Add state to track images that haven't been sent to analysis yet
  const [pendingAnalysisCount, setPendingAnalysisCount] = useState(0);
  
  // State to track which image URIs have been sent for analysis
  const [imagesSentForAnalysis, setImagesSentForAnalysis] = useState(new Set());
  

  
  // Global button disable tracking - helps prevent multiple captures
  const [captureDisabled, setCaptureDisabled] = useState(false);

  // Listen for dimension changes
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    
    return () => subscription.remove();
  }, []);

  // Initialize pending analysis count when component mounts
  useEffect(() => {
    // Use the same accurate logic as actualPendingCount for the initial state
    const pendingCount = captures.filter(img => 
      !img.analyzed && 
      !imagesSentForAnalysis.has(img.uri)
    ).length;
    
    setPendingAnalysisCount(pendingCount);
  }, [captures, imagesSentForAnalysis]); // Re-run when captures or imagesSentForAnalysis change

  // Watch for changes in captures and update pending count if needed
  useEffect(() => {
    // Only count images that haven't been analyzed AND haven't been sent to analysis yet
    // This effect should run after initial load to set the correct count
    if (!isAnalyzing && activeAnalysisCount === 0) {
      // If we're not analyzing, all unanalyzed images are pending analysis
      setPendingAnalysisCount(captures.filter(img => !img.analyzed).length);
    }
    // If we are analyzing, don't change pendingAnalysisCount here
    // It will be managed by the capture and analysis events
  }, [captures, isAnalyzing, activeAnalysisCount]);

  // Cleanup speech display timer when component unmounts or voice listening stops
  useEffect(() => {
    return () => {
      if (speechDisplayTimerRef.current) {
        clearTimeout(speechDisplayTimerRef.current);
        speechDisplayTimerRef.current = null;
      }
      if (finalResultTimerRef.current) {
        finalResultTimerRef.current = null;
      }
      // Clear processed prompts on unmount
      processedVoicePromptsRef.current.clear();
      lastFinalResultRef.current = '';
      isProcessingVoiceCaptureRef.current = false;
    };
  }, []);

  // Track photo URIs across operations
  const captureUriMapRef = useRef(new Map());
  
  // Track processed voice prompts to prevent duplicates
  const processedVoicePromptsRef = useRef(new Set());
  
  // Track if we're currently processing a voice capture to prevent text updates
  const isProcessingVoiceCaptureRef = useRef(false);
  
  // Define processVoiceCapture first, before it's used in handleSpeechResult
  const processVoiceCapture = useCallback(async (text) => {
    if (processedVoicePromptsRef.current.has(text)) {
      return;
    }
    
    if (!cameraRef.current) {
      return;
    }
    // Mark this prompt as processed to prevent duplicates
    processedVoicePromptsRef.current.add(text);
    
    // Set flag to prevent further text updates during capture
    isProcessingVoiceCaptureRef.current = true;
    
    // Clear display text immediately when processing starts
    setDisplayText('');
    setSpokenPrompt('');
    
    // Clear the speech display timer
    if (speechDisplayTimerRef.current) {
      clearTimeout(speechDisplayTimerRef.current);
      speechDisplayTimerRef.current = null;
    }
    
    // Disable capture to prevent multiple triggers
    setCaptureDisabled(true);
    
    // Store timestamp to help identify duplicate captures
    const captureTimestamp = Date.now();
      
    try {
      // Take the photo directly
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: Platform.OS === 'android'
      });
      
      if (!photo) {
        throw new Error('Failed to capture photo');
      }
      
      // Create capture with prompt
      const capture = {
        ...photo,
        customPrompt: text,
        timestamp: captureTimestamp
      };
      
      // Add to captures using our handler
      handleNewImage(capture);
      
      // Use ref value instead of closure value to get latest state
      const currentIsImmediateAnalysisActive = isImmediateAnalysisActiveRef.current;
      
      // Handle immediate analysis if enabled, but don't block the UI
      if (currentIsImmediateAnalysisActive) {
        // Use a non-blocking approach for analysis to prevent freezing image capture
        setTimeout(async () => {
          try {
            // Mark this image as sent for analysis
            setImagesSentForAnalysis(prevSent => {
              const newSent = new Set(prevSent);
              newSent.add(capture.uri);
              return newSent;
            });
            
            // Increment the active analysis counter
            setActiveAnalysisCount(count => count + 1);
            
            // Set the main analyzing flag
            setIsAnalyzing(true);
            

            
            // Voice-prompted analyses get highest priority
            await analyzeImages([capture], PRIORITY.HIGH);
          } catch (err) {
            // Analysis error handled silently for production
          }
        }, 100);
      }
    } catch (err) {
      // Error handling for production - don't expose detailed errors
    } finally {
      // Reset the processing flag to allow text updates again
      setTimeout(() => {
        isProcessingVoiceCaptureRef.current = false;
      }, 2000); // Wait 2 seconds before allowing text updates
      
      // Keep processed prompts longer to prevent duplicates from multiple final results
      setTimeout(() => {
        processedVoicePromptsRef.current.delete(text);
      }, 10000); // Increased from 5s to 10s for better duplicate prevention
      
      // Allow new captures sooner
      const captureTimerDelay = 1000;
      setTimeout(() => {
        setCaptureDisabled(false);
      }, captureTimerDelay);
    }
  }, [cameraRef, handleNewImage, analyzeImages, setPendingAnalysisCount]);
  
  // Ensure camera is ready before capturing
  const handleCapturePhoto = useCallback(async (customPrompt = '') => {
    if (!cameraReady || captureDisabled) {
      return;
    }

    // Set capture disabled to prevent rapid multiple captures
    setCaptureDisabled(true);

    try {
      // Try to capture photo
      const photo = await capturePhoto();
      
      if (!photo) {
        setCaptureDisabled(false);
        return;
      }
      
      // Attach the voice prompt to the photo
      const photoWithPrompt = customPrompt ? { 
        ...photo, 
        customPrompt,
        timestamp: Date.now() 
      } : photo;
      
      // Add the capture to the list using our handler
      handleNewImage(photoWithPrompt);
      
      // Handle immediate analysis
      if (isImmediateAnalysisActive) {
        // Begin analysis in a non-blocking way
        setTimeout(async () => {
          // Mark this image as sent for analysis
          setImagesSentForAnalysis(prevSent => {
            const newSent = new Set(prevSent);
            newSent.add(photoWithPrompt.uri);
            return newSent;
          });
          
          // Increment the active analysis counter
          setActiveAnalysisCount(count => count + 1);
          
          // Set the main analyzing flag
          setIsAnalyzing(true);
          
          
          try {
            // Use PRIORITY.HIGH for immediate analysis
            await analyzeImages([photoWithPrompt], PRIORITY.HIGH);
          } catch (error) {
            // Handle immediate analysis error silently for production
          }
        }, 50); // Small delay to ensure UI responsiveness
      }
      
      // Re-enable capture immediately after the photo is taken and saved, regardless of analysis
      setTimeout(() => {
        setCaptureDisabled(false);
      }, 300);
      
      return photoWithPrompt;
    } catch (error) {
      setCaptureDisabled(false);
      throw error;
    } 
  }, [cameraReady, capturePhoto, handleNewImage, isImmediateAnalysisActive, analyzeImages, setPendingAnalysisCount]);

  // Function to handle image analysis
  const handleAnalyzeImages = async () => {
    // Make a copy of the current captures to avoid race conditions
    const capturesCopy = [...captures];
    
    // Get unanalyzed images that haven't been sent for analysis
    const unanalyzedImages = capturesCopy.filter(
      img => !img.analyzed && !imagesSentForAnalysis.has(img.uri)
    );
    
    if (unanalyzedImages.length === 0) {
      return;
    }
    
    // Track these images as sent for analysis
    setImagesSentForAnalysis(prevSent => {
      const newSent = new Set(prevSent);
      unanalyzedImages.forEach(img => newSent.add(img.uri));
      return newSent;
    });
    
    // Increment the active analysis counter
    setActiveAnalysisCount(count => count + 1);
    
    // Set the main analyzing flag
    setIsAnalyzing(true);
    
    try {
      // Pass the STABLE copy of captures to avoid state changes during analysis
      await analyzeImages(capturesCopy, PRIORITY.NORMAL);
    } catch (error) {
      setCameraError(new Error('Failed to analyze images: ' + error.message));
      
      // Reset sent statuses on critical error
      setImagesSentForAnalysis(prevSent => {
        const newSent = new Set(prevSent);
        unanalyzedImages.forEach(img => newSent.delete(img.uri));
        return newSent;
      });
      
      // Decrement the active analysis counter and update isAnalyzing based on the new count
      setActiveAnalysisCount(count => {
        const newCount = Math.max(0, count - 1);
        
        // Set isAnalyzing to false if this was the last active analysis
        if (newCount === 0) {
          setIsAnalyzing(false);
        }
        
        return newCount;
      });
    }
  };

  // Add refs to track final results to prevent duplicates
  const lastFinalResultRef = useRef('');
  const finalResultTimerRef = useRef(null);

  // Handle speech recognition result - now defined after processVoiceCapture
  const handleSpeechResult = useCallback((text, isFinal, volume) => {
    if (isProcessingVoiceCaptureRef.current) {
      return;
    }
    
    // Always update spokenPrompt for real-time feedback
    setSpokenPrompt(text || '');
    
    // Only update displayText if we have actual content to avoid clearing it prematurely
    if (text && text.trim().length > 0) {
      setDisplayText(text);
      
      // Clear any existing timer
      if (speechDisplayTimerRef.current) {
        clearTimeout(speechDisplayTimerRef.current);
      }
      
      // Only set timer to clear text for final results to avoid gaps
      if (isFinal) {
        speechDisplayTimerRef.current = setTimeout(() => {
          // Only clear if this is still the same text (avoid clearing newer text)
          setDisplayText(prevText => prevText === text ? '' : prevText);
        }, 3000); // 3s timeout for final results only
      }
      // For partial results, don't set a clear timer - let the next result update it
    }
    
    // Enhanced duplicate prevention for final results
    if (text && text.length > 3 && isFinal) {
      // Check for similar final results within a short time window
      const currentTime = Date.now();
      const timeSinceLastFinal = finalResultTimerRef.current ? currentTime - finalResultTimerRef.current : Infinity;
      
      // If we had a recent final result, check similarity
      if (timeSinceLastFinal < 2000 && lastFinalResultRef.current) { // 2 second window
        const similarity = calculateTextSimilarity(text, lastFinalResultRef.current);
        if (similarity > 0.8) {
          return;
        }
      }
      
      // Check if we haven't already processed this exact text
      if (!processedVoicePromptsRef.current.has(text)) {
        lastFinalResultRef.current = text;
        finalResultTimerRef.current = currentTime;
        
        if (captureDisabled) {
          setTimeout(() => {
            processVoiceCapture(text);
          }, 1000);
          return;
        }
        
        processVoiceCapture(text);
      }
    }
  }, [processVoiceCapture, captureDisabled]);

  // Helper function to calculate text similarity
  const calculateTextSimilarity = useCallback((str1, str2) => {
    if (!str1 || !str2) return 0;
    
    // Normalize strings for comparison
    const norm1 = str1.toLowerCase().trim();
    const norm2 = str2.toLowerCase().trim();
    
    if (norm1 === norm2) return 1.0;
    
    // Check if one is a substring of the other with significant overlap
    const shorter = norm1.length < norm2.length ? norm1 : norm2;
    const longer = norm1.length >= norm2.length ? norm1 : norm2;
    
    if (longer.includes(shorter) && shorter.length > 10) {
      return shorter.length / longer.length;
    }
    
    // Simple word-based similarity
    const words1 = norm1.split(/\s+/);
    const words2 = norm2.split(/\s+/);
    const commonWords = words1.filter(word => words2.includes(word));
    
    return (2 * commonWords.length) / (words1.length + words2.length);
  }, []);

  // Handle volume changes from voice recognition
  const handleVolumeChange = useCallback((volume) => {
    setSpeechVolume(volume);
  }, []);

  // Handle listening state changes
  const handleListeningStateChange = useCallback((isListening) => {
    setIsVoiceListening(isListening);
  }, []);
  
  // Deep analysis states
  const [isDeepAnalyzing, setIsDeepAnalyzing] = useState(false);
  const [deepAnalyses, setDeepAnalyses] = useState([]);
  const [isDeepAnalysisResultsVisible, setIsDeepAnalysisResultsVisible] = useState(false);
  const [isPromptModalVisible, setIsPromptModalVisible] = useState(false);
  
  // Audio testing state
  const [showAudioTest, setShowAudioTest] = useState(false);
  
  // Function to handle deep analysis
  const handleDeepAnalysis = useCallback(async (userPrompt = "") => {
    if (captures.length === 0) {
      Alert.alert("No Captures", "Please capture at least one image before analyzing.");
      return;
    }
    
    setIsDeepAnalyzing(true);
    
    try {
      const result = await performDeepAnalysis(captures, userPrompt);
      
      if (result && !result.error) {
        // Add new analysis to the list
        setDeepAnalyses(prevAnalyses => [...prevAnalyses, result]);
        // Ensure the results view is visible
        setIsDeepAnalysisResultsVisible(true);
      } else {
        Alert.alert(
          "Analysis Failed", 
          result?.description || "An unknown error occurred during deep analysis."
        );
      }
    } catch (error) {
      Alert.alert("Analysis Error", "Failed to perform deep analysis. Please try again.");
    } finally {
      setIsDeepAnalyzing(false);
    }
  }, [captures]);

  // Function to handle deep analysis with selected images
  const handleDeepAnalysisWithSelection = useCallback(async (userPrompt = "", selectedCaptures = []) => {
    if (selectedCaptures.length === 0) {
      Alert.alert("No Images Selected", "Please select at least one image for analysis.");
      return;
    }
    
    setIsDeepAnalyzing(true);
    
    try {
      const result = await performDeepAnalysis(selectedCaptures, userPrompt);
      
      if (result && !result.error) {
        // Add new analysis to the list
        setDeepAnalyses(prevAnalyses => [...prevAnalyses, result]);
        // Ensure the results view is visible
        setIsDeepAnalysisResultsVisible(true);
      } else {
        Alert.alert(
          "Analysis Failed", 
          result?.description || "An unknown error occurred during deep analysis."
        );
      }
    } catch (error) {
      Alert.alert("Analysis Error", "Failed to perform deep analysis. Please try again.");
    } finally {
      setIsDeepAnalyzing(false);
    }
  }, []);
  
  // Open prompt modal for new analysis
  const handleAddNewAnalysis = useCallback(() => {
    setIsPromptModalVisible(true);
  }, []);
  
  // Submit prompt for analysis
  const handlePromptSubmit = useCallback((prompt, selectedCaptures) => {
    setIsPromptModalVisible(false);
    handleDeepAnalysisWithSelection(prompt, selectedCaptures);
  }, []);
  
  // Add additional voice recognition robustness by implementing a retry mechanism
  // This has been removed since the new VoiceButton handles its own error recovery
  
  // Register analysis event handlers to keep UI updated
  useEffect(() => {
    registerAnalysisEventHandlers({
      onAnalysisStart: (count) => {
        // The setActiveAnalysisCount is now handled at the start of each analysis operation
        setIsAnalyzing(true);
        
      },
      onAnalysisComplete: (updatedImages, failedAnalyses = []) => {
        // Create a copy of the current captures to avoid reference issues
        const capturesCopy = [...captures];
        
        // Only update images that exist in our capturesCopy
        for (const updatedImage of updatedImages) {
          const existingIndex = capturesCopy.findIndex(img => img.uri === updatedImage.uri);
          if (existingIndex !== -1) {
            capturesCopy[existingIndex] = { ...updatedImage };
          }
        }
        
        // Set the entire array at once to avoid partial updates
        updateCaptures(capturesCopy);
        
        // Log the state after updating captures
        
        
        // Add specific logging for red circle counter
        
        
        if (failedAnalyses.length > 0) {
          
          
        }
        
        // Decrement the active analysis counter and update isAnalyzing based on the new count
        setActiveAnalysisCount(count => {
          const newCount = Math.max(0, count - 1);
          
          // Set isAnalyzing to false if this was the last active analysis
          if (newCount === 0) {
            setIsAnalyzing(false);
          }
          
          return newCount;
        });
        
        // Handle failed analyses properly
        if (failedAnalyses.length > 0) {
          setImagesSentForAnalysis(prev => {
            const newSet = new Set(prev);
            // Remove failed analyses from sent set so they can be retried
            failedAnalyses.forEach(img => newSet.delete(img.uri));
            return newSet;
          });
          
          // Log imagesSentForAnalysis state after update
          setTimeout(() => {
            
          }, 0);
        } else {
          // FIX: Instead of resetting the entire set, only remove the successfully analyzed images
          setImagesSentForAnalysis(prev => {
            const newSet = new Set(prev);
            // Remove only the successfully analyzed images
            updatedImages.forEach(img => newSet.delete(img.uri));
            
            return newSet;
          });
        }
      },
      onImageAnalyzed: (image) => {
        
        
        // Update a single image by modifying the state with a function
        // This ensures we always have the latest state to work with
        updateCaptures(prevCaptures => {
          // Create a fresh copy to avoid reference issues
          const capturesCopy = [...prevCaptures];
          const index = capturesCopy.findIndex(img => img.uri === image.uri);
          
          if (index !== -1) {
            capturesCopy[index] = { ...image };
          }
          
          return capturesCopy;
        });
        
        // Remove successfully analyzed image from sent set
        setImagesSentForAnalysis(prev => {
          const newSet = new Set(prev);
          newSet.delete(image.uri);
          return newSet;
        });
      },
      onError: (error, failedImage) => {
        if (failedImage) {
          
          
          
          // Update with functional form to get latest state
          updateCaptures(prevCaptures => {
            const capturesCopy = [...prevCaptures];
            const index = capturesCopy.findIndex(img => img.uri === failedImage.uri);
            
            if (index !== -1) {
              capturesCopy[index] = { 
                ...capturesCopy[index], 
                analyzed: false 
              };
              
              
              
              
              
            }
            
            return capturesCopy;
          });
          
          // Remove from sent set so it can be retried
          setImagesSentForAnalysis(prev => {
            const newSet = new Set(prev);
            newSet.delete(failedImage.uri);
            
            return newSet;
          });
          
          // We don't decrement the active analysis counter here, as it will be handled by onAnalysisComplete
        }
      }
    });
    
    return () => {
      // Clear handlers on unmount
      registerAnalysisEventHandlers({
        onAnalysisStart: null,
        onAnalysisComplete: null,
        onImageAnalyzed: null,
        onError: null
      });
  };
  }, [captures, updateCaptures]);

  // Update the actual pending count calculation to include failed analyses
  // and use it for both pendingAnalysisCount state and actualPendingCount value
  const actualPendingCount = useMemo(() => {
    // Images that need analysis are:
    // 1. Not analyzed
    // 2. Not currently in the process of being analyzed
    const pendingCount = captures.filter(img => 
      !img.analyzed && 
      !imagesSentForAnalysis.has(img.uri)
    ).length;    
    
    setPendingAnalysisCount(pendingCount);
    
    return pendingCount;
  }, [captures, imagesSentForAnalysis, activeAnalysisCount]);

  // Main app UI
  return (
    <View style={styles.container}>
      {/* Camera */}
      <CameraView 
        dimensions={dimensions}
        cameraReady={cameraReady}
        setCameraReady={setCameraReady}
        setCameraError={setCameraError}
        cameraRef={cameraRef}
        isCapturing={isCapturing}
      />
      
      {/* Speech wave visualizer */}
      <SpeechWaveVisualizer 
        isListening={isVoiceListening} 
        text={displayText} 
        volume={speechVolume} // Use the speech volume state
      />
      
      {/* Top control bar for voice and immediate analysis buttons */}
      <View style={customStyles.topControlBar}>
        <View style={customStyles.buttonGroup}>
          <VoiceButton 
            onSpeechResult={handleSpeechResult}
            onVolumeChange={handleVolumeChange}
            onListeningStateChange={handleListeningStateChange}
            onError={(error) => {
              setCameraError(error);
            }}
          />
          <ImmediateAnalysisButton 
            isActive={isImmediateAnalysisActive} 
            onToggle={() => setIsImmediateAnalysisActive(!isImmediateAnalysisActive)}
            isAnalyzing={isAnalyzing}
          />
        </View>
      </View>
      
      {/* Centered capture button */}
      {!isCardsExpanded && (
          <CaptureButton 
            onPress={() => handleCapturePhoto()}
            isCapturing={isCapturing}
            disabled={!cameraReady || captureDisabled} // Remove isAnalyzing from disabled condition
            captureButtonScale={captureButtonScale}
          />
      )}
      
      {/* Expanded card view - will handle its own touch prevention */}
      {expandedCardIndex !== null && captures[expandedCardIndex] && (
        <ExpandedCard 
          capture={captures[expandedCardIndex]}
          cardAnimation={cardAnimation}
          dimensions={dimensions}
          collapseCard={collapseCard}
        />
      )}
      
      {/* Render CardGroup for expanded mode only */}
      {isCardsExpanded ? (
        <CardGroup 
          isCardsExpanded={isCardsExpanded}
          scrollViewRef={scrollViewRef}
          captures={captures}
          toggleCardGroup={toggleCardGroup}
          expandCard={expandCard}
          dimensions={dimensions}
        />
      ) : null}
      
      {/* Render CardStack only when not expanded */}
      {!isCardsExpanded && captures.length > 0 && (
        <CardStack 
          captures={captures} 
          toggleCardGroup={toggleCardGroup} 
          dimensions={dimensions}
        />
      )}
      
      {/* Analyze button */}
      {captures.length > 0 && (
        <AnalyzeButton 
          onPress={handleAnalyzeImages}
          isAnalyzing={isAnalyzing}
          unanalyzedCount={captures.filter(img => !img.analyzed).length}
          pendingAnalysisCount={actualPendingCount}
        />
      )}
      

      
      {/* Deep Analysis Button */}
      {captures.length > 0 && !isCardsExpanded && (
        <DeepAnalysisButton 
          onPress={() => {
            if (deepAnalyses.length > 0) {
              setIsDeepAnalysisResultsVisible(true);
            } else {
              handleAddNewAnalysis();
            }
          }}
          isAnalyzing={isDeepAnalyzing}
          hasDeepAnalysis={deepAnalyses.length > 0}
          analyzedCount={captures.filter(img => img.analyzed).length}
          totalCount={captures.length}
        />
      )}
      
      {/* New Analysis Prompt Modal */}
      <NewAnalysisPromptModal
        visible={isPromptModalVisible}
        onClose={() => setIsPromptModalVisible(false)}
        onSubmit={handlePromptSubmit}
        captures={captures}
      />
      
      {/* Error display */}
      {cameraError && <ErrorView error={cameraError} />}
      
      {/* Render DeepAnalysisResults absolutely last to ensure it's on top */}
      {isDeepAnalysisResultsVisible && (
        <DeepAnalysisResults 
          analyses={deepAnalyses}
          isAnalyzing={isDeepAnalyzing}
          onClose={() => setIsDeepAnalysisResultsVisible(false)}
          onAddNewAnalysis={handleAddNewAnalysis}
        />
      )}
    </View>
  );
}

// Additional styles for new components
const customStyles = StyleSheet.create({
  topControlBar: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 160, // Higher than AnalyzeButton to ensure proper layering
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  buttonGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 30,
    padding: 6,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
      android: {
        elevation: 6, // Higher elevation to prevent it from appearing behind other elements
      },
      web: {
        boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.3)',
      }
    }),
  },
  recordingIndicator: {
    position: 'absolute', 
    top: 70,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    zIndex: 150,
  },
  recordingText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  }
});