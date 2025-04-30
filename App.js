import React, { useState, useEffect, useCallback } from 'react';
import { LogBox, View, Dimensions, TouchableOpacity, Text, Platform, StyleSheet, Alert } from 'react-native';
import { Camera } from 'expo-camera';

// Components
import CameraView from './components/camera/CameraView';
import CaptureButton from './components/camera/CaptureButton';
import CardGroup from './components/cards/CardGroup';
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
    captures, addCapture, isCardsExpanded, expandedCardIndex,
    toggleCardGroup, expandCard, collapseCard, handleOutsideClick, 
    scrollCards, scrollViewRef, cardAnimation, cardGroupBackgroundOpacity, 
    panResponder, cardGroupStyles, expandAnimation
  } = useCardStack(dimensions);

  // Add state for voice recognition and immediate analysis
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isImmediateAnalysisActive, setIsImmediateAnalysisActive] = useState(false);
  const [spokenPrompt, setSpokenPrompt] = useState('');
  const [isVoiceCapturing, setIsVoiceCapturing] = useState(false);

  // Add state for analysis tracking
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Calculate unanalyzed images count
  const unanalyzedCount = captures.filter(img => !img.analyzed).length;

  // Listen for dimension changes
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    
    return () => subscription.remove();
  }, []);

  // Handle photo capture and add to stack
  const handleCapturePhoto = async (customPrompt = '') => {
    // Prevent capture if analysis is in progress and immediate analysis is active
    if (isImmediateAnalysisActive && isAnalyzing) {
      console.log('Analysis in progress, capture prevented');
      return;
    }

    const photo = await capturePhoto();
    if (photo) {
      // Add custom prompt to photo if provided
      const photoWithPrompt = customPrompt ? { ...photo, customPrompt } : photo;
      
      // Add the photo to captures first
      addCapture(photoWithPrompt);
      
      // If immediate analysis is active, analyze this photo right away
      if (isImmediateAnalysisActive) {
        setIsAnalyzing(true);
        try {
          // Get the current captures array after adding the new photo
          const currentCaptures = [...captures, photoWithPrompt];
          
          // Analyze just the new photo
          const analyzedResult = await analyzeImages([photoWithPrompt]);
          if (analyzedResult && analyzedResult.length > 0) {
            const analyzedPhoto = analyzedResult[0];
            
            // Create an updated captures array with the analyzed photo
            const updatedCaptures = currentCaptures.map(capture => 
              capture.uri === analyzedPhoto.uri ? analyzedPhoto : capture
            );
            
            // Update all captures
            addCapture(null, updatedCaptures);
            
            // Expand the analyzed card (the most recent one)
            setTimeout(() => {
              expandCard(0);
            }, 500);
          }
        } catch (error) {
          console.error('Error analyzing image:', error);
          setCameraError(new Error('Failed to analyze image: ' + error.message));
        } finally {
          setIsAnalyzing(false);
        }
      }
    }
  };

  // Function to handle image analysis
  const handleAnalyzeImages = async () => {
    if (isAnalyzing || unanalyzedCount === 0) return;
    
    setIsAnalyzing(true);
    try {
      const analyzedImages = await analyzeImages(captures);
      // Update captures with analyzed results
      addCapture(null, analyzedImages); // Pass null as first param to replace all captures
    } catch (error) {
      console.error('Analysis error:', error);
      setCameraError(new Error('Failed to analyze images: ' + error.message));
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle speech recognition result with better error handling
  const handleSpeechResult = async (text) => {
    console.log('Speech recognized:', text);
    
    if (!text || text.trim().length === 0) {
      console.log('Empty speech result, ignoring');
      return;
    }
    
    setSpokenPrompt(text);
    setIsVoiceCapturing(true);
    
    try {
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
        }
      }, 500);
    } catch (error) {
      console.error('Error in speech result handling:', error);
      setIsVoiceCapturing(false);
      setSpokenPrompt('');
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
            onSpeechResult={handleSpeechResult}
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
            disabled={!cameraReady || (isImmediateAnalysisActive && isAnalyzing)}
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
      
      {/* Card group (compact or expanded) */}
      <CardGroup 
        isCardsExpanded={isCardsExpanded}
        scrollViewRef={scrollViewRef}
        captures={captures}
        toggleCardGroup={toggleCardGroup}
        expandCard={expandCard}
        dimensions={dimensions} // Pass dimensions down
      />
      
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