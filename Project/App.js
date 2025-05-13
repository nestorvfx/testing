import './src/utils/crypto-polyfill';
import './polyfills';
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
    if (!cameraReady) {
      return;
    }

    try {
      // Try to capture photo
      const photo = await capturePhoto();
      
      if (!photo) {
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
      }
      
      return photoWithPrompt;
    } catch (error) {
      console.error('Error capturing photo:', error);
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
    // Update UI with speech
    setSpokenPrompt(text);
    setSpeechVolume(volume);
    
    if (isFinalized && !isAnalyzing && !captureDisabled) {
      setIsVoiceCapturing(true);
      
      // Disable capture to prevent multiple triggers
      setCaptureDisabled(true);
      
      // Take the photo directly
      (async () => {
        try {
          // Check if camera is available
          if (!cameraRef.current) {
            setCaptureDisabled(false);
            setIsVoiceCapturing(false);
            return;
          }
          
          // Take the photo directly
          const photo = await cameraRef.current.takePictureAsync({
            quality: 0.85,
            skipProcessing: Platform.OS === 'android'
          });
          
          if (!photo) {
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
          
          // Use ref value instead of closure value to get latest state
          const currentIsImmediateAnalysisActive = isImmediateAnalysisActiveRef.current;
          
          // Handle immediate analysis if enabled
          if (currentIsImmediateAnalysisActive) {
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
  }, [spokenPrompt, isAnalyzing, captureDisabled, cameraRef, addCapture, updateCaptures, analyzeImages]);

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
            isAnalyzing={isAnalyzing || isVoiceCapturing}
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
  }
});