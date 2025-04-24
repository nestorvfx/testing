import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styles } from '../../styles';
import { isWeb } from '../../constants';

export const LoadingPermissionView = () => (
  <View style={[styles.container, styles.centeredContent]}>
    <Text style={styles.permissionText}>Requesting permissions...</Text>
  </View>
);

export const MediaPermissionView = ({ requestMediaPermissionOnly }) => (
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

export const DeniedPermissionView = ({ cameraError, retryPermissions }) => (
  <View style={[styles.container, styles.centeredContent]}>
    <Text style={styles.permissionText}>
      {isWeb 
        ? "Camera access denied. Please allow camera access in your browser settings."
        : "No access to camera or media library. Please grant permissions in your device settings."}
    </Text>
    <TouchableOpacity 
      style={styles.retryButton}
      onPress={retryPermissions}
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
