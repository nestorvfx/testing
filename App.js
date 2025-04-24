import React, { useState, useEffect } from 'react';
import { LogBox, View, Dimensions, TouchableOpacity, Text, Platform } from 'react-native';
import { Camera } from 'expo-camera';

// Components
import CameraView from './components/camera/CameraView';
import CaptureButton from './components/camera/CaptureButton';
import CardGroup from './components/cards/CardGroup';
import ExpandedCard from './components/cards/ExpandedCard';
import ErrorView from './components/ui/ErrorView';
import { LoadingPermissionView, MediaPermissionView, DeniedPermissionView } from './components/ui/PermissionViews';
import AnalyzeButton from './components/ui/AnalyzeButton';

// Hooks
import { useCamera } from './hooks/useCamera';
import { usePermissions } from './hooks/usePermissions';
import { useCardStack } from './hooks/useCardStack';

// Services
import { analyzeImages } from './services/perplexityService';

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

  // Permission related views
  if (hasPermission === null) {
    return <LoadingPermissionView />;
  }
  
  if (mediaPermissionOnly && !isWeb) {
    return <MediaPermissionView requestMediaPermissionOnly={requestMediaPermissionOnly} />;
  }
  
  if (hasPermission === false) {
    return (
      <DeniedPermissionView 
        cameraError={permissionError || cameraError}
        retryPermissions={retryPermissions}
      />
    );
  }

  // Main app UI
  return (
    <View style={styles.container} onTouchStart={handleOutsideClick}>
      {/* Camera */}
      <CameraView 
        dimensions={dimensions}
        cameraReady={cameraReady}
        setCameraReady={setCameraReady}
        setCameraError={setCameraError}
        cameraRef={cameraRef}
        isCapturing={isCapturing}
      />
      
      {/* Analyze button */}
      {captures.length > 0 && (
        <AnalyzeButton 
          onPress={handleAnalyzeImages}
          isAnalyzing={isAnalyzing}
          unanalyzedCount={unanalyzedCount}
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
      
      {/* Card group (compact or expanded) */}
      <CardGroup 
        isCardsExpanded={isCardsExpanded}
        cardGroupStyles={cardGroupStyles}
        scrollViewRef={scrollViewRef}
        captures={captures}
        scrollCards={scrollCards}
        toggleCardGroup={toggleCardGroup}
        expandCard={expandCard}
        panResponder={panResponder}
        cardGroupBackgroundOpacity={cardGroupBackgroundOpacity}
        expandAnimation={expandAnimation}
      />
      
      {/* Capture button */}
      <CaptureButton 
        onPress={handleCapturePhoto}
        isCapturing={isCapturing}
        disabled={!cameraReady}
        captureButtonScale={captureButtonScale}
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
