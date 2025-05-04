import React from 'react';
import { View, Image, TouchableOpacity, Text, Dimensions, Platform } from 'react-native';
import { styles } from '../../styles';

const CardStack = ({ captures, toggleCardGroup, dimensions }) => {
  if (!captures || captures.length === 0) return null;
  
  // Get screen width from dimensions prop or fallback
  const screenWidth = dimensions?.width || Dimensions.get('window').width;
  
  // More dynamic sizing based on screen width
  // Small screens: smaller cards
  // Large screens: larger cards
  let baseCardWidth;
  let leftPosition;
  
  if (screenWidth < 400) {
    // Very small screens (phones in portrait)
    baseCardWidth = Math.min(screenWidth * 0.20, 75); // Slightly bigger
    leftPosition = '-16%'; // Move even further left on small screens
  } else if (screenWidth < 600) {
    // Medium small screens
    baseCardWidth = Math.min(screenWidth * 0.17, 82);
    leftPosition = '-12%'; // More to the left
  } else if (screenWidth < 900) {
    // Medium screens (tablets, phones in landscape)
    baseCardWidth = Math.min(screenWidth * 0.12, 90);
    leftPosition = '-6%';
  } else {
    // Large screens
    baseCardWidth = Math.min(screenWidth * 0.09, 100);
    leftPosition = '-4%';
  }
  
  const cardHeight = baseCardWidth; // Keep it square
  const staggerOffset = baseCardWidth * 0.08; // 8% of card width
  const stackWidth = baseCardWidth + staggerOffset * 2 + 20; // Total width needed
  const stackHeight = cardHeight + staggerOffset * 2 + 10; // Total height needed
  
  // Badge size based on card size
  const badgeSize = Math.max(18, baseCardWidth * 0.24);
  
  // Create a touch container that covers the entire stack area with some padding
  return (
    <TouchableOpacity 
      style={{
        width: stackWidth + 10, // Add padding for easier tapping
        height: stackHeight + 10,
        left: leftPosition, // Dynamic left position based on screen size
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      onPress={() => {
        toggleCardGroup();
      }}
      activeOpacity={0.9}
    >
      <View style={{
        width: stackWidth,
        height: stackHeight,
        position: 'relative',
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
                elevation: index + 1,
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
  );
};

export default CardStack;
