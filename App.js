import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Image, ScrollView, Dimensions, TouchableOpacity, Platform, LogBox, Animated, Easing, PanResponder } from 'react-native';
import { Camera } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import * as ScreenOrientation from 'expo-screen-orientation';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

// Ignore specific warnings that might be coming from Expo Camera
LogBox.ignoreLogs(['ViewPropTypes']);

// Check if running on web
const isWeb = Platform.OS === 'web';

// Create safe camera constants for web
const CAMERA_TYPE = {
  back: isWeb ? undefined : Camera.Constants?.Type?.back,
  front: isWeb ? undefined : Camera.Constants?.Type?.front
};

// Constants for responsive design
const COMPACT_MAX_WIDTH = 180; // Maximum width for compact card group
const MAX_COMPACT_CARD_MARGIN = -60; // Maximum negative margin for overlapping cards
const MIN_COMPACT_CARD_MARGIN = -20; // Minimum negative margin when many cards
const CARD_STACK_OFFSET = 3; // Offset for stacked card appearance

// Mock WebCamera component for web when Camera component isn't available
const WebCamera = ({ children, style, onCameraReady }) => {
  const videoRef = useRef(null);
  
  useEffect(() => {
    if (videoRef.current) {
      // Get user media to access webcam
      navigator.mediaDevices.getUserMedia({ 
        video: true,
        audio: false 
      })
      .then(stream => {
        // Set the stream as the video source
        videoRef.current.srcObject = stream;
        // Call onCameraReady when video can play
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          if (onCameraReady) onCameraReady();
        };
      })
      .catch(error => {
        console.error('Error accessing webcam:', error);
      });
    }
    
    return () => {
      // Clean up the video stream when component unmounts
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);
  
  return (
    <View style={style}>
      <video 
        ref={videoRef} 
        style={{ 
          width: '100%', 
          height: '100%', 
          objectFit: 'cover' 
        }} 
        autoPlay 
        playsInline
        muted
      />
      {children}
    </View>
  );
};

// Mock takePictureAsync for the web camera
WebCamera.takePictureAsync = async ({ quality = 0.8 } = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const video = document.querySelector('video');
      if (!video) {
        reject(new Error('Video element not found'));
        return;
      }
      
      // Create a canvas element to capture from video
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw the video frame to the canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert to base64 data URL
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      
      // Create a structured response similar to expo-camera
      resolve({
        uri: dataUrl,
        width: canvas.width,
        height: canvas.height,
        exif: null,
        base64: dataUrl.split(',')[1]
      });
    } catch (error) {
      reject(error);
    }
  });
};

export default function App() {
  const [hasPermission, setHasPermission] = useState(null);
  const [captures, setCaptures] = useState([]);
  const [isCapturing, setIsCapturing] = useState(false);
  // Add this state for backwards compatibility with old UI elements
  const [isRecording, setIsRecording] = useState(false);
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isMounted, setIsMounted] = useState(true);
  const [mediaPermissionOnly, setMediaPermissionOnly] = useState(false);
  const [debug, setDebug] = useState({
    cameraConstants: !!Camera.Constants,
    cameraType: !!CAMERA_TYPE.back
  });
  
  // States for card functionality
  const [isCardsExpanded, setIsCardsExpanded] = useState(false);
  const [expandedCardIndex, setExpandedCardIndex] = useState(null);
  const scrollViewRef = useRef(null);
  
  // Animated values for smoother animations
  const cardAnimation = useRef(new Animated.Value(0)).current;
  const cardGroupAnimation = useRef(new Animated.Value(0)).current;
  const captureButtonScale = useRef(new Animated.Value(1)).current;
  const cardGroupWidth = useRef(new Animated.Value(COMPACT_MAX_WIDTH)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const cardStackTranslateY = useRef(new Animated.Value(0)).current;
  const cardStackScale = useRef(new Animated.Value(1)).current;
  const cardGroupBackgroundOpacity = useRef(new Animated.Value(0)).current;
  
  const cameraRef = useRef(null);

  // Debug useEffect - MUST be called in same order on every render
  useEffect(() => {
    console.log('Debug info:', {
      platformOS: Platform.OS,
      isWeb,
      cameraConstants: !!Camera.Constants,
      cameraConstantsType: !!Camera.Constants?.Type,
      cameraType: CAMERA_TYPE.back
    });
  }, []);
  
  // Effect for permissions and setup
  useEffect(() => {
    setIsMounted(true);
    
    const getPermissions = async () => {
      try {
        // For web platform, we only need camera permission, not media library
        if (isWeb) {
          console.log('Running on web platform - only checking camera permission');
          const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
          console.log('Camera permission status on web:', cameraStatus);
          
          if (isMounted) {
            setHasPermission(cameraStatus === 'granted');
            if (cameraStatus !== 'granted') {
              setCameraError(new Error(`Camera permission not granted: ${cameraStatus}`));
            }
          }
          return;
        }
        
        // Mobile platforms need both camera and media library permissions
        // Check existing permissions first
        const cameraPermissionInfo = await Camera.getCameraPermissionsAsync();
        const mediaLibraryPermissionInfo = await MediaLibrary.getPermissionsAsync();
        
        console.log('Existing camera permission:', cameraPermissionInfo);
        console.log('Existing media library permission:', mediaLibraryPermissionInfo);
        
        // If both permissions are already granted, set state immediately
        if (cameraPermissionInfo.status === 'granted' && mediaLibraryPermissionInfo.status === 'granted') {
          if (isMounted) {
            console.log('Both permissions are already granted, setting hasPermission to true');
            setHasPermission(true);
            setMediaPermissionOnly(false);
            return;
          }
        }

        // Special case: Camera granted but media undetermined - focus on requesting media permission
        if (cameraPermissionInfo.status === 'granted' && mediaLibraryPermissionInfo.status === 'undetermined') {
          console.log('Camera permission granted, but media permission undetermined. Focusing on media permission.');
          setMediaPermissionOnly(true);
          
          // Try explicitly requesting media library permission
          const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
          console.log('Media library permission status after explicit request:', mediaStatus);
          
          if (isMounted) {
            if (mediaStatus === 'granted') {
              console.log('Media permission now granted, enabling app');
              setHasPermission(true);
              setMediaPermissionOnly(false);
            } else {
              setHasPermission(false);
              setCameraError(new Error(
                `Media library permission not granted: ${mediaStatus}`
              ));
            }
          }
          return;
        }
        
        // Request camera permissions if not already granted
        const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
        console.log('Camera permission status after request:', cameraStatus);
        
        // Request media library permissions if not already granted
        const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
        console.log('Media library permission status after request:', mediaStatus);
        
        if (isMounted) {
          const permissionsGranted = cameraStatus === 'granted' && mediaStatus === 'granted';
          console.log('Setting hasPermission to:', permissionsGranted);
          setHasPermission(permissionsGranted);
          
          // If permissions were denied, set an error message
          if (!permissionsGranted) {
            setCameraError(new Error(
              `Permissions not granted. Camera: ${cameraStatus}, Media: ${mediaStatus}`
            ));
          }
        }
      } catch (error) {
        console.error('Error requesting permissions:', error);
        if (isMounted) {
          setCameraError(error);
          setHasPermission(false);
        }
      }
    };

    getPermissions();
    
    // Add a permission refresh mechanism
    const permissionCheckInterval = setInterval(async () => {
      if (!hasPermission && isMounted) {
        console.log('Checking permissions again...');
        getPermissions();
      } else {
        clearInterval(permissionCheckInterval);
      }
    }, 2000);  // Check every 2 seconds if permissions were not initially granted
    
    // Listen for dimension changes to handle responsive layout
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      if (isMounted) {
        setDimensions(window);
      }
    });
    
    return () => {
      setIsMounted(false);
      subscription.remove();
      clearInterval(permissionCheckInterval);
    };
  }, [hasPermission]);  // Add hasPermission as dependency

  // Calculate negative margin for compact cards based on number of cards
  const calculateCompactMargin = () => {
    if (captures.length <= 1) return 0;
    
    // As more cards are added, reduce the margin to keep fixed width
    const calculatedMargin = MAX_COMPACT_CARD_MARGIN + 
                            ((MAX_COMPACT_CARD_MARGIN - MIN_COMPACT_CARD_MARGIN) / 10) * Math.min(captures.length, 10);
    
    return Math.max(calculatedMargin, MIN_COMPACT_CARD_MARGIN);
  };

  // Function to capture a single photo
  const capturePhoto = async () => {
    if (!cameraReady) {
      console.warn('Camera is not ready yet');
      return;
    }
    
    // Prevent multiple rapid captures
    if (isCapturing) return;
    
    setIsCapturing(true);
    
    // Animate button press
    Animated.sequence([
      Animated.timing(captureButtonScale, {
        toValue: 0.9,
        duration: 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(captureButtonScale, {
        toValue: 1,
        duration: 200,
        easing: Easing.elastic(1.5),
        useNativeDriver: true,
      })
    ]).start();
    
    try {
      let photo;
      
      if (isWeb) {
        photo = await WebCamera.takePictureAsync({ quality: 0.8 });
      } else if (cameraRef.current) {
        // Add a small delay to avoid touch event issues
        await new Promise(resolve => setTimeout(resolve, 100));
        photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          skipProcessing: Platform.OS === 'android',
          exif: false,
        });
        
        // Save to media library on mobile
        try {
          await MediaLibrary.saveToLibraryAsync(photo.uri);
        } catch (error) {
          console.warn('Could not save to library:', error);
        }
      } else {
        throw new Error('Camera not available');
      }
      
      // Add metadata
      const photoWithMetadata = {
        ...photo,
        timestamp: Date.now(),
        description: "Captured scene at " + new Date().toLocaleTimeString(),
      };
      
      // Add to captures array with animation
      Animated.sequence([
        Animated.timing(cardOpacity, {
          toValue: 0.6,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
      
      // Update captures array with newest first
      setCaptures(prevCaptures => {
        const newCaptures = [photoWithMetadata, ...prevCaptures];
        if (newCaptures.length > 10) return newCaptures.slice(0, 10);
        return newCaptures;
      });
      
    } catch (error) {
      console.error('Error capturing photo:', error);
      setCameraError(error);
    } finally {
      setIsCapturing(false);
    }
  };

  // Add this function that was referenced but not defined
  const toggleRecording = () => {
    // Just redirect to our new photo capture function
    capturePhoto();
  };

  // Functions for handling card interactions with enhanced animations
  const toggleCardGroup = () => {
    // If an individual card is expanded, close it first
    if (expandedCardIndex !== null) {
      collapseCard();
      return;
    }
    
    // Toggle expanded state with animation
    const newExpanded = !isCardsExpanded;
    
    // Create a more seamless expansion animation
    Animated.parallel([
      // Card group width/position animation
      Animated.timing(cardGroupAnimation, {
        toValue: newExpanded ? 1 : 0,
        duration: 400,
        easing: newExpanded ? Easing.out(Easing.bezier(0.25, 1, 0.5, 1)) : Easing.in(Easing.ease),
        useNativeDriver: false,
      }),
      // Width animation
      Animated.timing(cardGroupWidth, {
        toValue: newExpanded ? dimensions.width : COMPACT_MAX_WIDTH,
        duration: 400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),
      // Fade in/out background
      Animated.timing(cardGroupBackgroundOpacity, {
        toValue: newExpanded ? 0.8 : 0,
        duration: 400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),
      // Scale animation for cards - more subtle
      Animated.timing(cardStackScale, {
        toValue: newExpanded ? 1 : 0.98,
        duration: 400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    ]).start(() => {
      setIsCardsExpanded(newExpanded);
    });
  };
  
  const expandCard = (index) => {
    setExpandedCardIndex(index);
    
    // Animate card expansion with bounce effect
    Animated.spring(cardAnimation, {
      toValue: 1,
      friction: 6, // Lower values = more oscillation
      tension: 40, // Tension affecting the spring force
      useNativeDriver: false,
    }).start();
  };
  
  const collapseCard = () => {
    // Animate card collapse with easing
    Animated.timing(cardAnimation, {
      toValue: 0,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      setExpandedCardIndex(null);
    });
  };
  
  // Handle click outside to collapse cards with animation
  const handleOutsideClick = (event) => {
    // Check if we have cards and if either the group is expanded or a card is expanded
    if (captures.length > 0 && (isCardsExpanded || expandedCardIndex !== null)) {
      const { locationY } = event.nativeEvent;
      
      // For expanded card, check if click is outside the expanded card area
      if (expandedCardIndex !== null) {
        const expandedCardBounds = {
          top: (dimensions.height - expandedCardStyle.container.height) / 2,
          bottom: (dimensions.height + expandedCardStyle.container.height) / 2,
          left: (dimensions.width - expandedCardStyle.container.width) / 2,
          right: (dimensions.width + expandedCardStyle.container.width) / 2,
        };
        
        const { locationX } = event.nativeEvent;
        if (locationY < expandedCardBounds.top || 
            locationY > expandedCardBounds.bottom ||
            locationX < expandedCardBounds.left ||
            locationX > expandedCardBounds.right) {
          collapseCard();
        }
        return;
      }
      
      // For expanded group, check if click is above the bottom bar
      if (isCardsExpanded) {
        const bottomAreaThreshold = dimensions.height - 150;
        if (locationY < bottomAreaThreshold) {
          toggleCardGroup();
        }
      }
    }
  };
  
  // Scroll to next/previous cards
  const scrollCards = (direction) => {
    if (scrollViewRef.current && captures.length > 0) {
      const itemWidth = 130; // Width of each card including margins
      
      // Get current scroll position
      scrollViewRef.current.scrollTo({
        x: direction === 'next' 
          ? itemWidth * 2 // Scroll forward
          : -itemWidth * 2, // Scroll backward
        animated: true
      });
    }
  };

  // Create enhanced pan responder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isCardsExpanded && expandedCardIndex === null,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return isCardsExpanded && 
               expandedCardIndex === null && 
               Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderMove: (_, gestureState) => {
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({
            x: -gestureState.dx,
            animated: false
          });
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (scrollViewRef.current) {
          if (Math.abs(gestureState.dx) > 50) {
            const direction = gestureState.dx > 0 ? 'prev' : 'next';
            scrollCards(direction);
          }
        }
      }
    })
  ).current;

  // Permission handling UI rendering
  if (hasPermission === null) {
    return (
      <View style={[styles.container, styles.centeredContent]}>
        <Text style={styles.permissionText}>Requesting permissions...</Text>
      </View>
    );
  }
  
  // Special UI when we need only media library permission (skip this on web)
  if (mediaPermissionOnly && !isWeb) {
    return (
      <View style={[styles.container, styles.centeredContent]}>
        <Text style={styles.permissionText}>
          Camera permission is granted, but we still need access to your photo library to save images.
        </Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={requestMediaPermissionOnly}
        >
          <Text style={styles.retryButtonText}>Grant Media Access</Text>
        </TouchableOpacity>
        <Text style={styles.helpText}>
          If the permission dialog doesn't appear, please enable media access in your device settings.
        </Text>
      </View>
    );
  }
  
  if (hasPermission === false) {
    return (
      <View style={[styles.container, styles.centeredContent]}>
        <Text style={styles.permissionText}>
          {isWeb 
            ? "Camera access denied. Please allow camera access in your browser settings."
            : "No access to camera or media library. Please grant permissions in your device settings."}
        </Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => {
            console.log('Retrying permission request');
            setHasPermission(null);  // Reset to trigger the permission flow again
            setMediaPermissionOnly(false);
          }}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
        {cameraError && (
          <Text style={styles.errorDetails}>
            Error details: {cameraError.message}
          </Text>
        )}
        
        {/* Different instructions for web vs mobile */}
        {isWeb ? (
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsTitle}>How to enable camera on web:</Text>
            <Text style={styles.instructionText}>1. Click the camera/lock icon in the address bar</Text>
            <Text style={styles.instructionText}>2. Select "Allow" for camera access</Text>
            <Text style={styles.instructionText}>3. Reload the page</Text>
          </View>
        ) : (
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsTitle}>How to enable permissions:</Text>
            <Text style={styles.instructionText}>1. Go to your device Settings</Text>
            <Text style={styles.instructionText}>2. Find and tap on "Apps" or "Applications"</Text>
            <Text style={styles.instructionText}>3. Find "PerplexitySceneCapture"</Text>
            <Text style={styles.instructionText}>4. Tap on "Permissions"</Text>
            <Text style={styles.instructionText}>5. Enable Camera and Storage permissions</Text>
          </View>
        )}
      </View>
    );
  }

  // Calculate camera styles based on dimensions
  const squareSize = Math.min(dimensions.width, dimensions.height);
  const cameraStyle = {
    ...styles.camera,
    width: dimensions.width,
    height: dimensions.height,
  };

  // Calculate the position for the capture guide to center it properly
  const guideSize = squareSize * 0.8;
  const guidePosition = {
    top: (dimensions.height - guideSize) / 2,
    left: (dimensions.width - guideSize) / 2,
  };

  // Function to render camera with platform-specific props
  const renderCamera = () => {
    // Common camera props
    const cameraProps = {
      style: cameraStyle,
      onCameraReady: () => {
        console.log('Camera is ready');
        setCameraReady(true);
      },
      onMountError: (error) => {
        console.error('Camera mount error:', error);
        setCameraError(error);
      }
    };

    // Only add ref to native Camera component, not to WebCamera
    if (!isWeb) {
      cameraProps.ref = cameraRef;
    }

    // Add platform-specific props
    if (!isWeb) {
      // Native platforms
      if (Camera.Constants && Camera.Constants.Type) {
        cameraProps.type = CAMERA_TYPE.back;
      }
      cameraProps.ratio = "16:9";
    }

    try {
      // On web, we'll use our custom WebCamera component
      const CameraComponent = isWeb ? WebCamera : Camera;
      
      // Set up the appropriate ref based on platform
      if (isWeb) {
        cameraRef.current = WebCamera;
      }

      return (
        <CameraComponent {...cameraProps}>
          <View style={styles.overlay}>
            {/* Capture guide / crosshair to show the square center area */}
            <View 
              style={[
                styles.captureGuide, 
                { 
                  width: guideSize, 
                  height: guideSize,
                  top: guidePosition.top,
                  left: guidePosition.left,
                }
              ]} 
            />
            
            {/* Remove or replace this with isCapturing indicator */}
            {isCapturing && (
              <View style={styles.recordingIndicator}>
                <Text style={styles.recordingText}>Capturing</Text>
              </View>
            )}
            
            {/* Captured images container */}
            <View style={styles.capturesContainer}>
              <ScrollView 
                horizontal={true} 
                style={styles.capturesScroll}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 70 }}
              >
                {captures.map((capture, index) => (
                  <Image
                    key={index}
                    source={{ uri: capture.uri }}
                    style={[
                      styles.captureImage, 
                      { 
                        zIndex: captures.length - index,
                        marginRight: index === captures.length - 1 ? 0 : -50
                      }
                    ]}
                  />
                ))}
              </ScrollView>
            </View>
            
            {/* Display camera initialization message */}
            {!cameraReady && (
              <View style={styles.initializing}>
                <Text style={styles.initializingText}>Initializing camera...</Text>
              </View>
            )}
          </View>
          <StatusBar style="auto" />
        </CameraComponent>
      );
    } catch (error) {
      console.error('Error rendering camera:', error);
      return (
        <View style={[styles.errorContainer, {position: 'relative', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#000'}]}>
          <Text style={styles.errorText}>
            Camera Error: {error.message || 'Failed to render camera component'}
          </Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              setHasPermission(null);
              setCameraError(null);
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
  };

  // Interpolate values for smoother animations
  const cardGroupBottomPosition = cardGroupAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0]
  });
  
  // Calculate dynamic styles for card group with animations
  const cardGroupStyles = {
    container: {
      ...styles.capturesContainer,
      bottom: cardGroupBottomPosition,
      left: cardGroupAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [20, 0]
      }),
      width: cardGroupWidth,
      // Use a numeric value instead of 'auto'
      height: cardGroupAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [100, 150] // Use 100 instead of 'auto'
      }),
      maxWidth: isCardsExpanded ? '100%' : COMPACT_MAX_WIDTH,
      backgroundColor: 'transparent',
      overflow: 'hidden',
      zIndex: 100,
    },
    background: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'black',
      opacity: cardGroupBackgroundOpacity,
      borderTopLeftRadius: cardGroupAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 16]
      }),
      borderTopRightRadius: cardGroupAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 16]
      }),
    },
    scroll: {
      ...styles.capturesScroll,
      // Use a numeric value instead of 'auto'
      height: cardGroupAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [100, 130] // Use 100 instead of 'auto'
      }),
      paddingTop: cardGroupAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 15]
      }),
      paddingBottom: cardGroupAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 15]
      }),
    }
  };

  // Calculate aspect ratio for portrait card (9:16)
  const cardWidth = dimensions.width * 0.85;
  const cardHeight = (cardWidth * 16) / 9; // 9:16 aspect ratio

  // Calculate expanded card styles with 9:16 aspect ratio and improved transitions
  const expandedCardStyle = {
    container: {
      position: 'absolute',
      zIndex: 2000,
      backgroundColor: 'white',
      borderRadius: 16,
      overflow: 'hidden',
      width: cardWidth,
      height: Math.min(cardHeight, dimensions.height * 0.85), // Ensure it's not too tall
      top: (dimensions.height - Math.min(cardHeight, dimensions.height * 0.85)) / 2,
      left: (dimensions.width - cardWidth) / 2,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 10,
        },
        android: {
          elevation: 10,
        },
        web: {
          boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.3)',
        }
      }),
      transform: [
        { scale: cardAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [0.9, 1]
          })
        },
        { translateY: cardAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [60, 0]
          })
        }
      ],
      opacity: cardAnimation
    },
    image: {
      width: '100%',
      height: '40%', // Larger image section for better portrait aspect ratio
      resizeMode: 'cover',
    },
    content: {
      padding: 20,
      flex: 1,
      backgroundColor: '#fff',
    },
    closeButton: {
      position: 'absolute',
      top: 12,
      right: 12,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2001,
    },
    closeButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold',
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 12,
      color: '#222',
    },
    description: {
      fontSize: 16,
      color: '#333',
      marginBottom: 15,
      lineHeight: 22,
    },
    metadata: {
      fontSize: 14,
      color: '#777',
      marginTop: 15,
    }
  };

  // Render expanded card if one is selected
  const renderExpandedCard = () => {
    if (expandedCardIndex === null) return null;
    
    const capture = captures[expandedCardIndex];
    if (!capture) return null;
    
    return (
      <Animated.View style={expandedCardStyle.container}>
        <Image source={{ uri: capture.uri }} style={expandedCardStyle.image} />
        
        {/* Gradient overlay on image for better text visibility */}
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'transparent']}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 60,
          }}
        />
        
        <View style={expandedCardStyle.content}>
          <Text style={expandedCardStyle.title}>
            Scene Capture
          </Text>
          <Text style={expandedCardStyle.description}>
            {capture.description || "No description available."}
          </Text>
          
          <View style={{
            height: 1,
            backgroundColor: '#eee',
            marginVertical: 15,
          }} />
          
          <Text style={expandedCardStyle.metadata}>
            Captured: {new Date(capture.timestamp).toLocaleString()}
          </Text>
          <Text style={expandedCardStyle.metadata}>
            Resolution: {capture.width} × {capture.height}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={expandedCardStyle.closeButton} 
          onPress={collapseCard}
          activeOpacity={0.7}
        >
          <Text style={expandedCardStyle.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Calculate the card spacing based on number of cards
  const compactMargin = calculateCompactMargin();
  
  // Use direct value for expanded state instead of interpolation for borderColor
  const getBorderColor = (isExpanded) => {
    return isExpanded ? 'rgba(255,255,255,0.8)' : 'white';
  };

  return (
    <View style={styles.container} onTouchStart={handleOutsideClick}>
      {hasPermission ? (
        <View style={{ flex: 1 }}>
          {renderCamera()}
          
          {/* Renders expanded card if one is selected */}
          {renderExpandedCard()}
          
          {/* Card group (collapsed or expanded) with improved animations */}
          <Animated.View style={cardGroupStyles.container}>
            <Animated.View style={cardGroupStyles.background} />
            
            {isCardsExpanded && (
              <View style={styles.cardNavigationContainer}>
                <TouchableOpacity 
                  style={styles.navigationButton} 
                  onPress={() => scrollCards('prev')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.navigationButtonText}>◀</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.navigationButton} 
                  onPress={() => scrollCards('next')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.navigationButtonText}>▶</Text>
                </TouchableOpacity>
              </View>
            )}
            
            <Animated.ScrollView 
              ref={scrollViewRef}
              horizontal={true} 
              style={cardGroupStyles.scroll}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ 
                paddingHorizontal: 10,
                alignItems: 'center'
              }}
              {...(isCardsExpanded ? panResponder.panHandlers : {})}
            >
              {captures.map((capture, index) => (
                <Animated.View 
                  key={index} 
                  style={[
                    { 
                      opacity: cardOpacity,
                      transform: !isCardsExpanded ? [
                        { translateY: index * CARD_STACK_OFFSET },
                        { scale: 1 - (index * 0.01) }
                      ] : [],
                      zIndex: captures.length - index,
                    }
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => isCardsExpanded 
                      ? expandCard(index) 
                      : toggleCardGroup()
                    }
                    activeOpacity={0.8}
                  >
                    <Animated.Image
                      source={{ uri: capture.uri }}
                      style={[
                        styles.captureImage, 
                        { 
                          width: cardGroupAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: [100, 120]
                          }),
                          height: cardGroupAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: [100, 120]
                          }),
                          marginHorizontal: cardGroupAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 5]
                          }),
                          marginRight: !isCardsExpanded && index !== captures.length - 1 
                            ? compactMargin 
                            : isCardsExpanded ? 5 : 0,
                          // Fix the interpolation issue by using a direct value
                          borderColor: getBorderColor(isCardsExpanded),
                          borderWidth: cardGroupAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: [2, 3]
                          }),
                          // Adding subtle shadow for depth effect
                          ...(!isCardsExpanded && Platform.select({
                            ios: {
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.2,
                              shadowRadius: 2,
                            },
                            android: {
                              elevation: 3,
                            },
                            web: {
                              boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.2)',
                            }
                          }))
                        }
                      ]}
                    />
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </Animated.ScrollView>
          </Animated.View>
          
          {/* Capture button with animation */}
          <Animated.View style={{
            transform: [{ scale: captureButtonScale }],
            position: 'absolute',
            bottom: 30,
            right: 30,
            zIndex: 50,
          }}>
            <TouchableOpacity 
              style={styles.captureButton} 
              onPress={capturePhoto}
              activeOpacity={0.7}
              disabled={!cameraReady || isCapturing}
            >
              <View style={styles.captureButtonInner}>
                {isCapturing && (
                  <View style={styles.capturingIndicator} />
                )}
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>
      ) : (
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>
            {hasPermission === false 
              ? "Camera access denied. Please allow camera access in your browser settings."
              : "Requesting camera permissions..."}
          </Text>
        </View>
      )}
      
      {/* Display camera error if any */}
      {cameraError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Camera Error: {cameraError.message || 'Unknown error'}</Text>
        </View>
      )}

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centeredContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
    position: 'relative',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  captureGuide: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 12,
    // Add subtle glow effect
    ...Platform.select({
      ios: {
        shadowColor: '#fff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        // No good elevation for white shadow on Android
      },
      web: {
        boxShadow: '0px 0px 10px rgba(255, 255, 255, 0.3)',
      }
    }),
  },
  // Replace record button with capture button
  captureButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.4)',
      }
    }),
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f44336',
    borderWidth: 3,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  capturingIndicator: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: 'white',
  },
  capturesContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    maxWidth: COMPACT_MAX_WIDTH,
    zIndex: 100,
  },
  capturesScroll: {
    flexDirection: 'row',
  },
  captureImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'white',
  },
  cardNavigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 101,
  },
  navigationButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  navigationButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // ...existing styles for permissions, errors, etc.
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#4285F4',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorDetails: {
    color: '#FF6B6B',
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  errorContainer: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(255, 0, 0, 0.7)',
    padding: 10,
    borderRadius: 8,
    zIndex: 1000,
  },
  errorText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  },
  instructionsContainer: {
    marginTop: 30,
    width: '80%',
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
  },
  instructionsTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  instructionText: {
    color: 'white',
    fontSize: 14,
    marginBottom: 5,
  },
  helpText: {
    color: 'white',
    fontSize: 14,
    marginTop: 15,
    textAlign: 'center',
    paddingHorizontal: 20,
    fontStyle: 'italic',
  },
  debugButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  debugButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
