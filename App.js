import React, { useState, useEffect } from 'react';
import { LogBox, View, Dimensions, TouchableOpacity, Text, Platform, StyleSheet } from 'react-native';
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
  const handleCapturePhoto = async () => {
    const photo = await capturePhoto();
    if (photo) {
      addCapture(photo);
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

  // Add state for deep analysis
  const [isDeepAnalysisDialogVisible, setIsDeepAnalysisDialogVisible] = useState(false);
  const [isPerformingDeepAnalysis, setIsPerformingDeepAnalysis] = useState(false);
  const [deepAnalysisResults, setDeepAnalysisResults] = useState(null);
  const [isDeepAnalysisResultsVisible, setIsDeepAnalysisResultsVisible] = useState(false);
  
  // Function to handle deep analysis
  const handleDeepAnalysis = async (customPrompt) => {
    if (captures.length === 0) return;
    
    setIsDeepAnalysisDialogVisible(false);
    setIsPerformingDeepAnalysis(true);
    
    try {
      const results = await performDeepAnalysis(captures, customPrompt);
      setDeepAnalysisResults(results);
      setIsDeepAnalysisResultsVisible(true);
    } catch (error) {
      console.error('Deep analysis error:', error);
      // Handle error - could show an error toast here
    } finally {
      setIsPerformingDeepAnalysis(false);
    }
  };
  
  // Function to toggle deep analysis dialog
  const toggleDeepAnalysisDialog = () => {
    // If we already have results, show them instead of the dialog
    if (deepAnalysisResults && !isDeepAnalysisResultsVisible) {
      setIsDeepAnalysisResultsVisible(true);
    } else if (!deepAnalysisResults) {
      setIsDeepAnalysisDialogVisible(!isDeepAnalysisDialogVisible);
    }
  };

  // Add this new function at the app component level
  const onScreenTap = (event) => {
    if (Platform.OS === 'android') {
      const { locationX, locationY } = event.nativeEvent;
      console.log(`Screen tapped at X: ${locationX}, Y: ${locationY}`);
      
      // Check if tap is in the bottom center area (where capture button should be)
      const bottomThird = dimensions.height * 2/3;
      const leftThird = dimensions.width * 1/3;
      const rightThird = dimensions.width * 2/3;
      
      if (locationY > bottomThird && locationX > leftThird && locationX < rightThird) {
        console.log('Tap detected in capture button area!');
        handleCapturePhoto();
      }
    }
  };

  // Permission related views - only show if we've definitively determined no permission
  if (hasPermission === false) {
    return (
      <DeniedPermissionView 
        cameraError={permissionError || cameraError}
        retryPermissions={retryPermissions}
      />
    );
  }
  
  // Skip all other permission checks to avoid flashes - just show the main UI
  // The camera component will handle showing its own errors if needed

  // Main app UI
  return (
    <View 
      style={styles.container} 
      onTouchStart={handleOutsideClick}
    >
      {/* Camera */}
      <CameraView 
        dimensions={dimensions}
        cameraReady={cameraReady}
        setCameraReady={setCameraReady}
        setCameraError={setCameraError}
        cameraRef={cameraRef}
        isCapturing={isCapturing}
      />
      
      {/* Centered capture button */}
      {!isCardsExpanded && (
          <CaptureButton 
            onPress={handleCapturePhoto}
            isCapturing={isCapturing}
            disabled={!cameraReady}
            captureButtonScale={captureButtonScale}
          />
      )}
      
      {/* Expanded card view */}
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
      
      {/* Deep Analysis Button - hide when cards are expanded */}
      {captures.length > 0 && !isCardsExpanded && (
        <DeepAnalysisButton 
          onPress={toggleDeepAnalysisDialog}
          isAnalyzing={isPerformingDeepAnalysis}
          hasDeepAnalysis={deepAnalysisResults !== null}
        />
      )}
      
      {/* Deep Analysis Dialog */}
      <DeepAnalysisDialog 
        visible={isDeepAnalysisDialogVisible}
        onClose={() => setIsDeepAnalysisDialogVisible(false)}
        onSubmit={handleDeepAnalysis}
        isLoading={isPerformingDeepAnalysis}
        captureCount={captures.length}
      />
      
      {/* Deep Analysis Results */}
      {deepAnalysisResults && isDeepAnalysisResultsVisible && (
        <DeepAnalysisResults 
          results={deepAnalysisResults}
          onClose={() => setIsDeepAnalysisResultsVisible(false)}
        />
      )}
      
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

// Update capture button position to better align with card stack and deep analysis button
const additionalStyles = StyleSheet.create({
  centeredCaptureButton: {
    position: 'absolute',
    bottom: 55, // Match the deep analysis button position
    width: '100%',
    alignItems: 'center',
    zIndex: 50,
  },
});