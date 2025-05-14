import './src/utils/crypto-polyfill';
import './polyfills';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LogBox, View, Dimensions, TouchableOpacity, Text, Platform, StyleSheet, Alert, ScrollView } from 'react-native';
import { Camera } from 'expo-camera';

// Helper functions for logging
const logInfo = (message) => {
  if (__DEV__) console.info(`[App] ${message}`);
};

// Components
import CameraView from './components/camera/CameraView';
import CaptureButton from './components/camera/CaptureButton';
import CardGroup from './components/cards/CardGroup';
import CardStack from './components/cards/CardStack'; // Add this import
import ExpandedCard from './components/cards/ExpandedCard';
import ErrorView from './components/ui/ErrorView';
import { LoadingPermissionView, MediaPermissionView, DeniedPermissionView } from './components/ui/PermissionViews';
import AnalyzeButton from './components/ui/AnalyzeButton';
import DeepAnalysisButton from './components/ui/DeepAnalysisButton';
import DeepAnalysisDialog from './components/ui/DeepAnalysisDialog';
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
import { analyzeImages, performDeepAnalysis } from './services/perplexityService';

// Styles and constants
import { styles } from './styles';
import { isWeb } from './constants';

// Ignore specific warnings that might be coming from Expo Camera
LogBox.ignoreLogs(['ViewPropTypes']);

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
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isImmediateAnalysisActive, setIsImmediateAnalysisActive] = useState(false);
  const isImmediateAnalysisActiveRef = useRef(false); // Add ref to track latest value
  
  // Update ref when state changes
  useEffect(() => {
    isImmediateAnalysisActiveRef.current = isImmediateAnalysisActive;
  }, [isImmediateAnalysisActive]);
  
  const [spokenPrompt, setSpokenPrompt] = useState('');
  const [isVoiceCapturing, setIsVoiceCapturing] = useState(false);
  const [speechVolume, setSpeechVolume] = useState(0); // Add speech volume state for visualizer

  // Add state for analysis tracking
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Global button disable tracking - helps prevent multiple captures
  const [captureDisabled, setCaptureDisabled] = useState(false);

  // Calculate unanalyzed images count
  const unanalyzedCount = captures.filter(img => !img.analyzed).length;

  // Listen for dimension changes
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    
    return () => subscription.remove();
  }, []);

  // Track photo URIs across operations
  const captureUriMapRef = useRef(new Map());
  
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
      
      // Add the capture to the list
      addCapture(photoWithPrompt);
      
      // Handle immediate analysis
      if (isImmediateAnalysisActive) {
        // Begin analysis in a non-blocking way
        setTimeout(async () => {
          setIsAnalyzing(true);
          
          try {            
            const analyzedResult = await analyzeImages([photoWithPrompt]);
            
            if (analyzedResult && analyzedResult.length > 0) {
              const analyzedPhoto = analyzedResult[0];
              
              updateCaptures(prevCaptures => 
                prevCaptures.map(c => 
                  c.uri === photoWithPrompt.uri ? { ...c, ...analyzedPhoto, analyzed: true } : c
                )
              );
            }
          } catch (error) {
            console.error('Error analyzing photo:', error);
          } finally {
            setIsAnalyzing(false);
          }
        }, 50); // Small delay to ensure UI responsiveness
      }
      
      // Re-enable capture immediately after the photo is taken and saved, regardless of analysis
      setTimeout(() => {
        setCaptureDisabled(false);
      }, 300);
      
      return photoWithPrompt;
    } catch (error) {
      console.error('Error capturing photo:', error);
      setCaptureDisabled(false); // Also re-enable on error
      throw error;
    } 
  }, [cameraReady, capturePhoto, addCapture, isImmediateAnalysisActive, updateCaptures, analyzeImages]);

  // Function to handle image analysis
  const handleAnalyzeImages = async () => {
    if (isAnalyzing || unanalyzedCount === 0) return;
    
    setIsAnalyzing(true);
    
    try {
      const analyzedImages = await analyzeImages(captures);
      
      // Update captures with analyzed results
      updateCaptures(analyzedImages);
    } catch (error) {
      console.error('Analysis error:', error);
      setCameraError(new Error('Failed to analyze images: ' + error.message));
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle speech recognition result
  const handleSpeechResult = useCallback((text, isFinalized, volume = 0) => {
    // Always update UI with speech for visual feedback
    setSpokenPrompt(text);
    setSpeechVolume(volume);
    
    // Only capture photo when we have a finalized result
    if (isFinalized) {
      logInfo(`Processing finalized speech: "${text}"`);
      
      // Check if capture is in progress
      if (captureDisabled) {
        logInfo('Capture already in progress, queuing this capture request');
        
        // Queue this capture for processing after current one completes
        setTimeout(() => {
          logInfo(`Processing queued capture for: "${text}"`);
          processVoiceCapture(text);
        }, 1500); // Wait 1.5 seconds before trying to process the queued capture
        return;
      }
      
      // Process the capture immediately if not disabled
      processVoiceCapture(text);
    }
  }, [spokenPrompt, cameraRef, addCapture, updateCaptures, analyzeImages]);
  
  // Separate function for voice capture processing to avoid code duplication
  const processVoiceCapture = useCallback(async (text) => {
    // Don't proceed if camera isn't ready
    if (!cameraRef.current) {
      logInfo('Camera not ready, cannot capture');
      return;
    }
    
    // isAnalyzing should NOT block voice capture
    setIsVoiceCapturing(true);
    
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
      
      logInfo(`Capturing photo with prompt: "${text}"`);
      
      // Add to captures
      addCapture(capture);
      
      // Use ref value instead of closure value to get latest state
      const currentIsImmediateAnalysisActive = isImmediateAnalysisActiveRef.current;
      
      // Handle immediate analysis if enabled, but don't block the UI
      if (currentIsImmediateAnalysisActive) {
        setIsAnalyzing(true);
        // Use a non-blocking approach for analysis to prevent freezing image capture
        setTimeout(async () => {
          try {
            const analyzedResult = await analyzeImages([capture]);
            if (analyzedResult && analyzedResult.length > 0) {
              updateCaptures(prevCaptures => 
                prevCaptures.map(c => 
                  c.uri === capture.uri ? { ...c, ...analyzedResult[0], analyzed: true } : c
                )
              );
            }
          } catch (err) {
            console.error('Analysis error:', err);
          } finally {
            setIsAnalyzing(false);
          }
        }, 100);
      }
    } catch (err) {
      console.error('Error during direct camera capture:', err);
      // Log more detailed error info
      if (err.message) logInfo(`Capture error: ${err.message}`);
    } finally {
      // Reset capture state immediately, not waiting for analysis to complete
      setIsVoiceCapturing(false);
      setSpokenPrompt('');
      setSpeechVolume(0);
      
      // Allow new captures sooner
      setTimeout(() => {
        setCaptureDisabled(false);
        logInfo('Re-enabling capture button');
      }, 1200); // Increased to 1.2 seconds to prevent rapid captures
      
      // IMPORTANT: Don't turn off voice recognition after a capture
      // This allows the system to continue listening for more prompts
    }
  }, [cameraRef, addCapture, updateCaptures, analyzeImages]);

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
      console.error("Error during deep analysis:", error);
      Alert.alert("Analysis Error", "Failed to perform deep analysis. Please try again.");
    } finally {
      setIsDeepAnalyzing(false);
    }
  }, [captures]);
  
  // Open prompt modal for new analysis
  const handleAddNewAnalysis = useCallback(() => {
    setIsPromptModalVisible(true);
  }, []);
  
  // Submit prompt for analysis
  const handlePromptSubmit = useCallback((prompt) => {
    setIsPromptModalVisible(false);
    handleDeepAnalysis(prompt);
  }, [handleDeepAnalysis]);
  
  // Add additional voice recognition robustness by implementing a retry mechanism
  const maxVoiceRetries = 3;
  const [voiceRetryCount, setVoiceRetryCount] = useState(0);
  const voiceRetryTimerRef = useRef(null);
  
  // Function to automatically retry voice activation if it appears to be stuck
  const startVoiceRetryTimer = useCallback(() => {
    // Clear any existing timer
    if (voiceRetryTimerRef.current) {
      clearTimeout(voiceRetryTimerRef.current);
    }
    
    // Set a new timer that will check if voice recognition is working
    voiceRetryTimerRef.current = setTimeout(() => {
      // Only attempt retry if voice is supposed to be active
      if (isVoiceActive) {
        // If we've had no speech activity for a while, try restarting
        const timeSinceLastActivity = Date.now() - lastVoiceActivityRef.current;
        
        if (timeSinceLastActivity > 20000 && voiceRetryCount < maxVoiceRetries) { // 20 seconds
          logInfo('Voice recognition appears stuck, attempting automatic restart');
          setVoiceRetryCount(prev => prev + 1);
          
          // Toggle off and on to restart
          setIsVoiceActive(false);
          setTimeout(() => {
            setIsVoiceActive(true);
            // Start another retry timer
            startVoiceRetryTimer();
          }, 1000);
        } else if (voiceRetryCount >= maxVoiceRetries) {
          // Too many retries, just turn it off
          logInfo('Maximum voice retry attempts reached, disabling voice recognition');
          setIsVoiceActive(false);
          setVoiceRetryCount(0);
        } else {
          // Still within retry limits, start another timer
          startVoiceRetryTimer();
        }
      }
    }, 30000); // Check every 30 seconds
  }, [isVoiceActive, voiceRetryCount]);
  
  // Keep track of last voice activity timestamp
  const lastVoiceActivityRef = useRef(Date.now());
  
  // Update last activity timestamp when we get speech
  useEffect(() => {
    if (spokenPrompt) {
      lastVoiceActivityRef.current = Date.now();
    }
  }, [spokenPrompt]);
  
  // Start retry timer when voice is activated
  useEffect(() => {
    if (isVoiceActive) {
      lastVoiceActivityRef.current = Date.now(); // Reset timestamp
      startVoiceRetryTimer();
    } else {
      // Clear timer when voice is deactivated
      if (voiceRetryTimerRef.current) {
        clearTimeout(voiceRetryTimerRef.current);
      }
      setVoiceRetryCount(0); // Reset retry count
    }
    
    return () => {
      if (voiceRetryTimerRef.current) {
        clearTimeout(voiceRetryTimerRef.current);
      }
    };
  }, [isVoiceActive, startVoiceRetryTimer]);
  
  // Enhanced error handling for voice recognition
  const maxErrorsBeforeAlert = 5;
  const [voiceErrorCount, setVoiceErrorCount] = useState(0);
  
  // Function to handle voice recognition errors
  const handleVoiceError = useCallback((error) => {
    logInfo(`Voice recognition error: ${error.message || 'Unknown error'}`);
    
    // Increment error count
    setVoiceErrorCount(prev => {
      const newCount = prev + 1;
      
      // Alert user if too many errors
      if (newCount >= maxErrorsBeforeAlert) {
        Alert.alert(
          "Voice Recognition Issue",
          "There seems to be a problem with voice recognition. Would you like to try restarting it?",
          [
            {
              text: "Restart",
              onPress: () => {
                // Reset error count
                setVoiceErrorCount(0);
                
                // Toggle off and back on to restart
                setIsVoiceActive(false);
                setTimeout(() => setIsVoiceActive(true), 1000);
              }
            },
            {
              text: "Turn Off",
              onPress: () => {
                setVoiceErrorCount(0);
                setIsVoiceActive(false);
              }
            }
          ]
        );
        
        // Reset after showing alert
        return 0;
      }
      
      return newCount;
    });
  }, []);
  
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
        isListening={isVoiceActive && !!spokenPrompt} 
        text={spokenPrompt} 
        volume={speechVolume} // Use the speech volume state
      />
      
      {/* Voice capturing indicator */}
      {isVoiceCapturing && (
        <View style={[styles.recordingIndicator, { top: 70 }]}>
          <Text style={styles.recordingText}>Processing: "{spokenPrompt}"</Text>
        </View>
      )}
      
      {/* Analysis indicator (subtle) */}
      {isAnalyzing && (
        <View style={customStyles.analysisIndicator}>
          <Text style={customStyles.analysisText}>Analyzing in background...</Text>
        </View>
      )}
      
      {/* Top control bar for voice and immediate analysis buttons */}
      <View style={customStyles.topControlBar}>
        <View style={customStyles.buttonGroup}>
          <VoiceButton 
            isActive={isVoiceActive}
            onToggleActive={() => setIsVoiceActive(!isVoiceActive)}
            onSpeechResult={(text, isFinalized, volume) => handleSpeechResult(text, isFinalized, volume)}
            isAnalyzing={isVoiceCapturing} // Only block during voice capture, not analysis
            onError={handleVoiceError} // Pass error handler to VoiceButton
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
          unanalyzedCount={unanalyzedCount}
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
        />
      )}
      
      {/* New Analysis Prompt Modal */}
      <NewAnalysisPromptModal
        visible={isPromptModalVisible}
        onClose={() => setIsPromptModalVisible(false)}
        onSubmit={handlePromptSubmit}
        imagesCount={captures.length}
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
    zIndex: 150,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  buttonGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 25,
    padding: 5,
  },
  analysisIndicator: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    zIndex: 150,
  },
  analysisText: {
    color: '#444',
    fontSize: 14,
    fontWeight: '500',
  }
});