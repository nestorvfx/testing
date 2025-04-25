import { Platform } from 'react-native';
import { Camera } from 'expo-camera';

// Check if running on web
export const isWeb = Platform.OS === 'web';

// Create safe camera constants for web - use front camera
export const CAMERA_TYPE = {
  back: isWeb ? undefined : Camera.Constants?.Type?.back, // Keep back type as back
  front: isWeb ? undefined : Camera.Constants?.Type?.front
};

// Constants for responsive design - make cards smaller overall
export const COMPACT_MAX_WIDTH = 160; // Reduced from 180
export const CARD_WIDTH = 80;      // Reduced from 100
export const CARD_HEIGHT = 80;     // Reduced from 100
export const STACK_OFFSET = 15;    // Reduced from 20
export const MAX_VISIBLE_CARDS = 5;
export const MAX_CARDS = 100;
