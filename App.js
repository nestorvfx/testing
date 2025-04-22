import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Image, ScrollView, Dimensions, TouchableOpacity, Platform, LogBox } from 'react-native';
import { Camera } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import * as ScreenOrientation from 'expo-screen-orientation';

// Ignore specific warnings that might be coming from Expo Camera
LogBox.ignoreLogs(['ViewPropTypes']);

// Check if running on web
const isWeb = Platform.OS === 'web';

// Create safe camera constants for web
const CAMERA_TYPE = {
  back: isWeb ? undefined : Camera.Constants?.Type?.back,
  front: isWeb ? undefined : Camera.Constants?.Type?.front
};

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
  
  const cameraRef = useRef(null);
  const captureIntervalRef = useRef(null);

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
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }
    };
  }, [hasPermission]);  // Add hasPermission as dependency

  // Function to capture a square image from the center of the camera view
  const captureSquareImage = async () => {
    if (isWeb) {
      try {
        // Use WebCamera's takePictureAsync method
        const photo = await WebCamera.takePictureAsync({
          quality: 0.8,
        });
        
        // Add the captured image to the captures array
        setCaptures(prevCaptures => {
          // Keep only the last 10 captures to avoid memory issues
          const newCaptures = [...prevCaptures, photo];
          if (newCaptures.length > 10) return newCaptures.slice(1);
          return newCaptures;
        });
        
        return photo;
      } catch (error) {
        console.error('Error capturing image on web:', error);
        setCameraError(error);
      }
    } else if (cameraRef.current && cameraReady) {
      // Original native implementation
      try {
        // Add a small delay before taking the picture to avoid touch event issues
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          skipProcessing: Platform.OS === 'android', // Only use skipProcessing on Android
          exif: false, // Disable EXIF data to improve performance
        });
        
        // Save to media library on mobile platforms
        try {
          await MediaLibrary.saveToLibraryAsync(photo.uri);
          console.log('Saved photo to library');
        } catch (error) {
          console.warn('Could not save to library:', error);
        }
        
        // Add the captured image to the captures array
        setCaptures(prevCaptures => {
          // Keep only the last 10 captures to avoid memory issues
          const newCaptures = [...prevCaptures, photo];
          if (newCaptures.length > 10) return newCaptures.slice(1);
          return newCaptures;
        });
        
        return photo;
      } catch (error) {
        console.error('Error capturing image:', error);
        setCameraError(error);
      }
    } else {
      console.warn('Camera is not ready yet');
    }
  };

  // Toggle recording and capture at intervals
  const toggleRecording = () => {
    if (!cameraReady) {
      console.warn('Camera is not ready yet');
      return;
    }
    
    // Prevent multiple rapid taps which can cause touch event issues
    if (captureIntervalRef.current !== null && isRecording) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
      setIsRecording(false);
    } else if (captureIntervalRef.current === null && !isRecording) {
      setIsRecording(true);
      // Use a slight delay before starting the interval to avoid touch event conflicts
      setTimeout(() => {
        // Capture immediately when recording starts
        captureSquareImage();
        // Then set up the interval for subsequent captures
        captureIntervalRef.current = setInterval(captureSquareImage, 5000); // Capture every 5 seconds
      }, 200);
    }
  };

  // Calculate the square size based on the smaller dimension
  const calculateSquareSize = () => {
    const { width, height } = dimensions;
    return Math.min(width, height);
  };

  // Special handler for media permission only
  const requestMediaPermissionOnly = async () => {
    try {
      console.log('Explicitly requesting only media library permission');
      const { status } = await MediaLibrary.requestPermissionsAsync();
      console.log('Media library permission status after explicit request:', status);
      
      if (status === 'granted') {
        console.log('Media permission granted, enabling app');
        setHasPermission(true);
        setMediaPermissionOnly(false);
      } else {
        setCameraError(new Error(`Media library permission denied: ${status}`));
      }
    } catch (error) {
      console.error('Error requesting media permission:', error);
      setCameraError(error);
    }
  };

  // Handle when permissions are not granted
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
  const squareSize = calculateSquareSize();
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

  // Function to render camera safely with platform-specific props
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
            
            {/* Recording indicator */}
            {isRecording && (
              <View style={styles.recordingIndicator}>
                <Text style={styles.recordingText}>Recording</Text>
              </View>
            )}
            
            {/* Record button */}
            <TouchableOpacity 
              style={[styles.recordButton, isRecording ? styles.recordingButton : {}]} 
              onPress={toggleRecording}
              activeOpacity={0.7}
              disabled={!cameraReady}
            >
              <Text style={styles.buttonText}>{isRecording ? 'Stop' : 'Record'}</Text>
            </TouchableOpacity>
            
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

  return (
    <View style={styles.container}>
      {hasPermission ? (
        renderCamera()
      ) : (
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>
            {hasPermission === false 
              ? "Camera permission denied. Please allow camera access in your browser settings."
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

      {/* Add debug info button for web */}
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
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 8,
  },
  recordButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#f44336',
    padding: 15,
    borderRadius: 50,
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    // Use boxShadow for web, keep elevation/shadow* for native
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 2,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: '0px 2px 2px rgba(0, 0, 0, 0.8)',
      }
    }),
  },
  recordingButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  recordingIndicator: {
    position: 'absolute',
    top: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 0, 0, 0.5)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  recordingText: {
    color: 'white',
    fontWeight: 'bold',
  },
  capturesContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    maxWidth: '60%',
  },
  capturesScroll: {
    flexDirection: 'row-reverse', // Recent captures appear on the left
  },
  captureImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'white',
  },
  initializing: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  initializingText: {
    color: 'white',
    fontSize: 18,
  },
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
