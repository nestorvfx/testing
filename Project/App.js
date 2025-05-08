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
import VoiceDebugOverlay from './components/ui/VoiceDebugOverlay';

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
      // Keep only the last  messages
      const newLogs = [...prev, { timestamp, message, data }];
      if (newLogs.length > 20) return newLogs.slice(-20);
      return newLogs;
    });
  }, []);
  
  // Ensure camera is ready before capturing
  const handleCapturePhoto = useCallback(async (customPrompt = '') => {
    console.log(`handleCapturePhoto called with prompt: "${customPrompt}"`);
    
    if (!cameraReady) {
      console.log('Camera not ready, cannot capture');
      return;
    }
    
    if (customPrompt) {
      console.log(`Capturing photo with prompt: "${customPrompt}"`);
    }

    try {
      // Try to capture photo
      console.log('Attempting to capture photo...');
      const photo = await capturePhoto();
      
      if (!photo) {
        console.log('Photo capture returned null');
        return;
      }
      
      // Attach the voice prompt to the photo
      const photoWithPrompt = customPrompt ? { 
        ...photo, 
        customPrompt,
        timestamp: Date.now() 
      } : photo;
      
      console.log(`Photo captured successfully ${customPrompt ? 'with prompt' : ''}`);
      
      // Add the capture to the list
      addCapture(photoWithPrompt);
      
      // Handle immediate analysis
      if (isImmediateAnalysisActive) {
        console.log('Starting immediate analysis...');
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
            
            console.log('Photo analyzed successfully');
          }
        } catch (error) {
          console.error('Error analyzing photo:', error);
        } finally {
          setIsAnalyzing(false);
        }
      }
      
      return photoWithPrompt;
    } catch (error) {
      console.error('Error capturing photo:', error);
      throw error;
    } 
  }, [cameraReady, capturePhoto, addCapture, isImmediateAnalysisActive, updateCaptures, analyzeImages]);

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

  // Handle speech recognition result
  const handleSpeechResult = useCallback((text, isFinalized, volume = 0) => {
    // Log the full text that we received
    console.log(`handleSpeechResult received text: "${text}", finalized: ${isFinalized}`);
    
    if (isFinalized || text.length > 5 || text !== spokenPrompt) {
      console.log(`Speech recognized: ${text}`);
    }
    
    // Make sure we're keeping the full text
    setSpokenPrompt(text);
    setSpeechVolume(volume);
    
    if (isFinalized && !isAnalyzing && !captureDisabled) {
      console.log(`Processing finalized speech: "${text}" for photo capture`);
      setIsVoiceCapturing(true);
      
      // Disable capture to prevent multiple triggers
      setCaptureDisabled(true);
      
      // DIRECT CAMERA CAPTURE - bypass handleCapturePhoto for testing
      (async () => {
        console.log(`Taking photo directly with prompt: "${text}"`);
        
        try {
          // Check if camera is available
          if (!cameraRef.current) {
            console.log('No camera reference available');
            setCaptureDisabled(false);
            setIsVoiceCapturing(false);
            return;
          }
          
          // Take the photo directly
          const photo = await cameraRef.current.takePictureAsync({
            quality: 0.85,
            skipProcessing: Platform.OS === 'android'
          });
          
          console.log(`Photo captured: ${photo ? photo.uri : 'null'}`);
          
          if (!photo) {
            console.log('Photo capture failed - returned null');
            setCaptureDisabled(false);
            setIsVoiceCapturing(false);
            return;
          }
          
          // Create capture with prompt
          const capture = {
            ...photo,
            customPrompt: text,
            timestamp: Date.now()
          };
          
          // Add to captures
          addCapture(capture);
          console.log(`Capture added with prompt: "${text}"`);
          
          // Handle immediate analysis if enabled
          if (isImmediateAnalysisActive) {
            setIsAnalyzing(true);
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
          }
        } catch (err) {
          console.error('Error during direct camera capture:', err);
        } finally {
          // Reset state
          setTimeout(() => {
            setIsVoiceCapturing(false);
            setSpokenPrompt('');
            setSpeechVolume(0);
            setCaptureDisabled(false);
          }, 1000);
        }
      })();
    }
  }, [spokenPrompt, isAnalyzing, captureDisabled, cameraRef, addCapture, isImmediateAnalysisActive, updateCaptures, analyzeImages]);

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
  
  // Add debug state for voice
  const [voiceDebugInfo, setVoiceDebugInfo] = useState({
    isListening: false,
    speechText: '',
    volume: 0,
    errorMessage: '',
    state: {},
    isActive: false,
    inCooldown: false,
    isAnalyzing: false
  });
  const [showVoiceDebug, setShowVoiceDebug] = useState(__DEV__); // Show in dev mode by default
  
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
            onDebugInfo={setVoiceDebugInfo}
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
      
      {/* Render DeepAnalysisResults absolutely last to ensure it's on top */}
      {isDeepAnalysisResultsVisible && (
        <DeepAnalysisResults 
          analyses={deepAnalyses}
          isAnalyzing={isDeepAnalyzing}
          onClose={() => setIsDeepAnalysisResultsVisible(false)}
          onAddNewAnalysis={handleAddNewAnalysis}
        />
      )}
      
      {/* Voice Debug Overlay */}
      <VoiceDebugOverlay 
        isVisible={showVoiceDebug}
        isListening={voiceDebugInfo.isListening}
        speechText={voiceDebugInfo.speechText}
        volume={voiceDebugInfo.volume}
        errorMessage={voiceDebugInfo.errorMessage}
        state={voiceDebugInfo.state}
        isActive={voiceDebugInfo.isActive}
        inCooldown={voiceDebugInfo.inCooldown}
        isAnalyzing={voiceDebugInfo.isAnalyzing}
      />
      
      {/* Debug Toggle Button */}
      {__DEV__ && (
        <TouchableOpacity 
          style={customDebugStyles.debugToggleButton}
          onPress={() => setShowVoiceDebug(!showVoiceDebug)}
        >
          <Text style={customDebugStyles.debugToggleText}>🎤</Text>
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

// Create a separate styles object for debug elements
const customDebugStyles = StyleSheet.create({
  debugToggleButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  debugToggleText: {
    color: 'white',
    fontSize: 18,
  },
});