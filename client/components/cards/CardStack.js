import React from 'react';
import { View, Image, TouchableOpacity, Text, Dimensions, Platform } from 'react-native';
import { styles } from '../../styles';

const CardStack = ({ captures, toggleCardGroup, dimensions, style = {} }) => {
  if (!captures || captures.length === 0) return null;
  
  // Get screen width from dimensions prop or fallback
  const screenWidth = dimensions?.width || Dimensions.get('window').width;
  
  // More dynamic sizing based on screen width
  // Small screens: smaller cards
  // Large screens: larger cards
  let baseCardWidth;
  let leftOffset;
  
  if (screenWidth < 400) {
    // Very small screens (phones in portrait)
    baseCardWidth = Math.min(screenWidth * 0.20, 75);
    leftOffset = -40; // Use absolute pixels instead of percentages
  } else if (screenWidth < 600) {
    // Medium small screens
    baseCardWidth = Math.min(screenWidth * 0.17, 82);
    leftOffset = -35;
  } else if (screenWidth < 900) {
    // Medium screens (tablets, phones in landscape)
    baseCardWidth = Math.min(screenWidth * 0.12, 90);
    leftOffset = -25;
  } else {
    // Large screens
    baseCardWidth = Math.min(screenWidth * 0.09, 100);
    leftOffset = -20;
  }
  
  const cardHeight = baseCardWidth; // Keep it square
  const staggerOffset = baseCardWidth * 0.08; // 8% of card width
  const stackWidth = baseCardWidth + staggerOffset * 2 + 20; // Total width needed
  const stackHeight = cardHeight + staggerOffset * 2 + 10; // Total height needed
  
  // Badge size based on card size
  const badgeSize = Math.max(18, baseCardWidth * 0.24);

  const topForStack = Platform.OS === 'web' ? '5%' : '-5%'; // Adjust for Android status bar
  
  // Create a touch container that covers the entire stack area with some padding
  return (
    <View 
      style={{
        width: stackWidth + 20, // Wider to ensure touch area coverage
        height: stackHeight + 20, // Taller to ensure touch area coverage
        left: 30 + leftOffset, // Position relative to left edge of screen + offset
        bottom: 10, // Match CardGroup bottom position
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
        // Android-specific elevation to ensure proper touch handling
        elevation: Platform.OS === 'android' ? 15 : undefined,
        zIndex: Platform.OS === 'android' ? 1500 : 1010,
        // Pointer events box-none on iOS to allow clicks through to children
        // But auto on Android to ensure touches are captured
        pointerEvents: Platform.OS === 'android' ? 'auto' : 'box-none',
        ...style,
      }}
    >
      <TouchableOpacity 
        style={{
          width: '100%',
          height: '100%',
          justifyContent: 'center',
          alignItems: 'center',
          top:topForStack,
          // Add hitSlop to expand touch area beyond visual bounds
          hitSlop: { top: 0, bottom: 0, left: 0, right: 0 }
        }}
        onPress={toggleCardGroup}
        activeOpacity={0.8}
        // Essential: Prevent touch propagation beyond this component on Android
        onStartShouldSetResponderCapture={Platform.OS === 'android' ? () => true : undefined}
      >
        <View style={{
          width: stackWidth,
          height: stackHeight,
          // Add elevation to ensure Android touch events are captured correctly
          elevation: Platform.OS === 'android' ? 11 : undefined,
          zIndex: 1005,
        }}>
          {/* Photo count badge - responsive */}
          <View style={{
            position: 'absolute',
            top: -badgeSize * 0.4,
            right: -badgeSize * 0.4,
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
            backgroundColor: '#f44336',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            elevation: Platform.OS === 'android' ? 10 : undefined,
            borderWidth: Math.max(1, badgeSize * 0.075),
            borderColor: 'white',
          }}>
            <Text style={{
              color: 'white',
              fontSize: Math.max(10, badgeSize * 0.5),
              fontWeight: 'bold',
            }}>
              {captures.length}
            </Text>
          </View>
          
          {/* Render most recent 3 captures in stack formation - responsive */}
          {captures.slice(0, 3).map((capture, index) => {
            // Position from right to left (newest on top)
            const stack = captures.length;
            const currentStagger = index * staggerOffset;
            
            return (
              <View 
                key={index} 
                style={{
                  position: 'absolute',
                  width: baseCardWidth,
                  height: cardHeight,
                  right: currentStagger,
                  top: index * (staggerOffset * 0.2),
                  zIndex: stack - index,
                  borderRadius: baseCardWidth * 0.12,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 3,
                  // Use consistent elevation pattern that's lower than container
                  elevation: Platform.OS === 'android' ? 9 - index : index + 1,
                }}
              >
                <Image 
                  source={{ uri: capture.uri }} 
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: baseCardWidth * 0.12,
                    borderWidth: Math.max(1.5, baseCardWidth * 0.02),
                    borderColor: 'white',
                  }}
                />
              </View>
            );
          })}
        </View>
      </TouchableOpacity>
    </View>
  );
};

export default CardStack;
