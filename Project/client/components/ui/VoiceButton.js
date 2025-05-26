import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ociVoiceService from '../../services/ociVoiceService';

const VoiceButton = ({ 
  onSpeechResult, 
  onVolumeChange, 
  onListeningStateChange,
  disabled = false 
}) => {
  // Core three-state model: inactive, processing, active
  const [buttonState, setButtonState] = useState('inactive'); // 'inactive', 'processing', 'active'
  const [currentVolume, setCurrentVolume] = useState(0);
  
  // Refs for cleanup
  const isUnmounted = useRef(false);
  
  useEffect(() => {
    return () => {
      isUnmounted.current = true;
    };
  }, []);

  // Voice service event handlers
  const handleSpeechStart = useCallback(() => {
    console.log('[VoiceButton] Speech started - setting active state');
    if (!isUnmounted.current) {
      setButtonState('active');
      if (onListeningStateChange) {
        onListeningStateChange(true);
      }
    }
  }, [onListeningStateChange]);  const handleSpeechResult = useCallback((result) => {
    console.log('[VoiceButton] Final speech result received:', result);
    if (!isUnmounted.current && onSpeechResult) {
      // Ensure this is marked as a final result
      const finalResult = typeof result === 'string' ? result : result.value?.[0] || '';
      onSpeechResult(finalResult, true, 0); // text, isFinal=true, volume=0
    }
  }, [onSpeechResult]);

  const handleSpeechPartialResults = useCallback((result) => {
    console.log('[VoiceButton] Partial speech result received:', result);
    if (!isUnmounted.current && onSpeechResult) {
      // Ensure this is marked as a partial result
      const partialResult = typeof result === 'string' ? result : result.value?.[0] || '';
      onSpeechResult(partialResult, false, 0); // text, isFinal=false, volume=0
    }
  }, [onSpeechResult]);

  const handleSpeechEnd = useCallback(() => {
    console.log('[VoiceButton] Speech ended - setting inactive state');
    if (!isUnmounted.current) {
      setButtonState('inactive');
      setCurrentVolume(0);
      if (onListeningStateChange) {
        onListeningStateChange(false);
      }
    }
  }, [onListeningStateChange]);

  const handleVolumeChange = useCallback((volume) => {
    if (!isUnmounted.current) {
      setCurrentVolume(volume);
      if (onVolumeChange) {
        onVolumeChange(volume);
      }
    }
  }, [onVolumeChange]);

  const handleSpeechError = useCallback((error) => {
    console.log('[VoiceButton] Speech error:', error);
    if (!isUnmounted.current) {
      // Check if it's an unfixable error
      const errorMessage = error?.message || error?.toString() || '';
      const isUnfixable = errorMessage.includes('Permission denied') || 
                         errorMessage.includes('NotAllowedError') ||
                         errorMessage.includes('NotSupportedError');
      
      if (isUnfixable) {
        console.log('[VoiceButton] Unfixable error - setting inactive state');
        setButtonState('inactive');
      } else {
        console.log('[VoiceButton] Recoverable error - setting processing state');
        setButtonState('processing');
        // Auto-reset after 2 seconds for recoverable errors
        setTimeout(() => {
          if (!isUnmounted.current) {
            setButtonState('inactive');
          }
        }, 2000);
      }
      
      setCurrentVolume(0);
      if (onListeningStateChange) {
        onListeningStateChange(false);
      }
    }
  }, [onListeningStateChange]);  // Set up voice service listeners
  useEffect(() => {
    const service = ociVoiceService;
    
    service.setOnSpeechStart(handleSpeechStart);
    service.setOnSpeechResults(handleSpeechResult);
    service.setOnSpeechPartialResults(handleSpeechPartialResults);
    service.setOnSpeechEnd(handleSpeechEnd);
    service.setOnSpeechVolumeChanged(handleVolumeChange);
    service.setOnSpeechError(handleSpeechError);

    return () => {
      service.setOnSpeechStart(null);
      service.setOnSpeechResults(null);
      service.setOnSpeechPartialResults(null);
      service.setOnSpeechEnd(null);
      service.setOnSpeechVolumeChanged(null);
      service.setOnSpeechError(null);
    };
  }, [handleSpeechStart, handleSpeechResult, handleSpeechPartialResults, handleSpeechEnd, handleVolumeChange, handleSpeechError]);

  // Button press handler
  const handlePress = useCallback(async () => {
    if (disabled) return;

    console.log('[VoiceButton] Button pressed, current state:', buttonState);

    try {      if (buttonState === 'active') {
        // Stop listening
        console.log('[VoiceButton] Stopping voice recognition');
        setButtonState('processing');
        await ociVoiceService.stopListening();
        setButtonState('inactive');
      } else if (buttonState === 'inactive') {
        // Start listening
        console.log('[VoiceButton] Starting voice recognition');
        setButtonState('processing');
        await ociVoiceService.startListening();
        // State will be updated by event handlers
      }
    } catch (error) {
      console.error('[VoiceButton] Error in handlePress:', error);
      handleSpeechError(error);
    }
  }, [buttonState, disabled, handleSpeechError]);

  // Get button style based on state
  const getButtonStyle = () => {
    const baseStyle = {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 2,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
    };

    switch (buttonState) {
      case 'active':
        return {
          ...baseStyle,
          backgroundColor: '#4CAF50', // Green for active listening
        };
      case 'processing':
        return {
          ...baseStyle,
          backgroundColor: '#ffa500', // Orange for processing/on-hold
        };
      default: // inactive
        return {
          ...baseStyle,
          backgroundColor: disabled ? '#cccccc' : '#f0f0f0', // Gray for inactive
        };
    }
  };

  // Get icon based on state
  const getIcon = () => {
    switch (buttonState) {
      case 'active':
        return 'mic';
      case 'processing':
        return 'hourglass-empty';
      default: // inactive
        return 'mic-off';
    }
  };

  // Get icon color
  const getIconColor = () => {
    switch (buttonState) {
      case 'active':
        return '#fff';
      case 'processing':
        return '#fff';
      default: // inactive
        return disabled ? '#999' : '#666';
    }
  };

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Icon
        name={getIcon()}
        size={20}
        color={getIconColor()}
      />
    </TouchableOpacity>
  );
};

export default VoiceButton;
