import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LogBox, View, Dimensions, TouchableOpacity, Text, Platform, StyleSheet, Alert, ScrollView } from 'react-native';
import { Camera } from 'expo-camera';

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

  // Add debugging state
  const [debugInfo, setDebugInfo] = useState([]);
  const debugEnabled = true; // Toggle this to enable/disable debugging
  const captureUriMapRef = useRef(new Map()); // Track photo URIs across operations
  
  // Debug logging helper
  const debugLog = useCallback((message, data = null) => {
    if (!debugEnabled) return;
    
    const timestamp = new Date().toISOString().substr(11, 8);
    console.log(`[DEBUG ${timestamp}] ${message}`, data || '');
    
    setDebugInfo(prev => {
      // Keep only the last 20 messages
      const newLogs = [...prev, { timestamp, message, data }];
      if (newLogs.length > 20) return newLogs.slice(-20);
      return newLogs;
    });
  }, []);
  
  // Handle photo capture and add to stack
  const handleCapturePhoto = async (customPrompt = '') => {
    // Prevent capture if analysis is in progress or capture disabled
    if (isAnalyzing || captureDisabled) {
      console.log('Analysis in progress or capture prevented');
      return;
    }

    // Set a disable state to prevent multiple captures
    setCaptureDisabled(true);
    
    try {
      const photo = await capturePhoto();
      if (photo) {
        // Add custom prompt to photo if provided
        const photoWithPrompt = customPrompt ? { ...photo, customPrompt } : photo;
        const photoUri = photoWithPrompt.uri;
        
        console.log('Captured photo with URI:', photoUri);
                
        // Add the photo to captures - UPDATED to use new API
        addCapture(photoWithPrompt);
        
        // If immediate analysis is active, analyze this photo right away
        if (isImmediateAnalysisActive) {
          // Wait a moment for state to update
          await new Promise(resolve => setTimeout(resolve, 100));
          
          setIsAnalyzing(true);
          
          try {            
            // Analyze just the new photo
            const analyzedResult = await analyzeImages([photoWithPrompt]);
            
            const analyzedPhoto = analyzedResult[0];
            console.log('Analysis complete, analyzed photo:', analyzedPhoto.uri);
            
            updateCaptures([...captures, analyzedPhoto]);
                
            expandCard(captures.length);
          } catch (error) {
            console.error('Error analyzing image:', error);
            Alert.alert(
              'Analysis Error',
              'Failed to analyze the captured image. You can try again or analyze it manually.'
            );
          } finally {
            setIsAnalyzing(false);
          }
        }
      }
    } finally {
      // Re-enable capture after a delay
      setTimeout(() => {
        setCaptureDisabled(false);
      }, 1000);
    }
  };
  
  // Debug-enhanced regular analyze
  const handleAnalyzeImages = async () => {
    if (isAnalyzing || unanalyzedCount === 0) return;
    
    debugLog('Starting regular analysis', { captureCount: captures.length });
    setIsAnalyzing(true);
    
    try {
      const analyzedImages = await analyzeImages(captures);
      debugLog('Regular analysis complete', { resultCount: analyzedImages.length });
      
      // Update captures with analyzed results - UPDATED
      updateCaptures(analyzedImages); // Pass null as first param to replace all captures
      debugLog('Captures updated with analysis results');
    } catch (error) {
      debugLog('Analysis error', { message: error.message });
      console.error('Analysis error:', error);
      setCameraError(new Error('Failed to analyze images: ' + error.message));
    } finally {
      setIsAnalyzing(false);
      debugLog('Analysis state reset');
    }
  };

  // Handle speech recognition result with better error handling
  const handleSpeechResult = async (text, isFinalized = true, volume = 0) => {
    console.log('Speech recognized:', text);
    
    if (!text || text.trim().length === 0) {
      console.log('Empty speech result, ignoring');
      return;
    }
    
    setSpokenPrompt(text);
    setSpeechVolume(volume); // Update volume for visualizer
    
    // Only take photo and set capturing state if this is the finalized result
    // and we're not already analyzing or button is disabled
    if (isFinalized && !isAnalyzing && !captureDisabled) {
      setIsVoiceCapturing(true);
      
      try {
        // Also disable capture button to prevent manual capture during voice capture
        setCaptureDisabled(true);
        
        // Short delay to allow UI to update
        setTimeout(async () => {
          try {
            // Capture photo with the spoken text as custom prompt
            await handleCapturePhoto(text);
          } catch (error) {
            console.error('Error capturing photo with speech prompt:', error);
            Alert.alert(
              'Voice Capture Error',
              'There was a problem capturing with your voice prompt. Please try again.'
            );
          } finally {
            setIsVoiceCapturing(false);
            setSpokenPrompt('');
            setSpeechVolume(0); // Reset volume when done
          }
        }, 500);
      } catch (error) {
        console.error('Error in speech result handling:', error);
        setIsVoiceCapturing(false);
        setSpokenPrompt('');
        setSpeechVolume(0);
      }
    }
  };

  // Deep analysis states
  const [isDeepAnalyzing, setIsDeepAnalyzing] = useState(false);
  const [deepAnalyses, setDeepAnalyses] = useState([]);
  const [isDeepAnalysisResultsVisible, setIsDeepAnalysisResultsVisible] = useState(false);
  const [isPromptModalVisible, setIsPromptModalVisible] = useState(false);
  
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
      
      {/* Top control bar for voice and immediate analysis buttons */}
      <View style={customStyles.topControlBar}>
        <View style={customStyles.buttonGroup}>
          <VoiceButton 
            isActive={isVoiceActive}
            onToggleActive={() => setIsVoiceActive(!isVoiceActive)}
            onSpeechResult={(text, isFinalized, volume) => handleSpeechResult(text, isFinalized, volume)}
            isAnalyzing={isAnalyzing || isVoiceCapturing} // Pass analyzing state to control when listening should pause
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
            disabled={!cameraReady || isAnalyzing || captureDisabled}
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
      
      {/* Add debug info for expanded card (will be removed in production) */}
      {Platform.OS === 'android' && (
        <View style={{ 
          position: 'absolute', 
          top: 40, 
          right: 10, 
          zIndex: 9999,
          backgroundColor: 'transparent'
        }}>
          <Text style={{ color: 'transparent', fontSize: 1 }}>
            {`Card expanded: ${expandedCardIndex !== null}`}
          </Text>
        </View>
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
      
      {/* Deep Analysis Results */}
      {isDeepAnalysisResultsVisible && (
        <DeepAnalysisResults 
          analyses={deepAnalyses}
          isAnalyzing={isDeepAnalyzing}
          onClose={() => setIsDeepAnalysisResultsVisible(false)}
          onAddNewAnalysis={handleAddNewAnalysis}
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
      
      {/* Debug button for web */}
      {isWeb && (
        <TouchableOpacity 
          style={styles.debugButton}
          onPress={() => {
            alert(JSON.stringify({
              platformOS: Platform.OS,
              cameraConstantsExists: !!Camera.Constants,
              cameraTypeExists: !!Camera.Constants?.Type,
              hasPermission
            }, null, 2));
          }}
        >
          <Text style={styles.debugButtonText}>?</Text>
        </TouchableOpacity>
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
});