import { Platform, UIManager, NativeModules } from 'react-native';

/**
 * Safely enables LayoutAnimation for Android based on architecture
 * 
 * In the New Architecture, setLayoutAnimationEnabledExperimental is a no-op
 * This utility function checks if we're using the legacy architecture
 * before attempting to enable layout animations
 */
export const enableLayoutAnimations = () => {
  if (Platform.OS === 'android') {
    // Check if using legacy architecture or if the UIManager has the method
    const hasNewArchitecture = UIManager.hasViewManagerConfig?.('RCTView')?.uiViewClassName === 'RCTView';
    
    // Only make the call in legacy architecture
    if (!hasNewArchitecture && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }
};
