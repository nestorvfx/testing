import React, { useRef, useEffect } from 'react';
import { View } from 'react-native';

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
      
      // Apply horizontal flip to the canvas context to match the video display
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
      
      // Draw the video frame to the canvas (already flipped)
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

export default WebCamera;
