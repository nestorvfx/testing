import React, { useRef, useEffect } from 'react';
import { View, TouchableOpacity, Image, Text, Dimensions, Animated, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import CardStack from './CardStack';

const CardGroup = ({ 
  isCardsExpanded,
  scrollViewRef,
  captures,
  toggleCardGroup,
  expandCard,
  dimensions
}) => {
  // Improved responsive sizing
  const { width: screenWidth } = Dimensions.get('window');
  
  // More responsive card sizing based on screen width with more aggressive scaling
  // For small screens: 17% of width, medium: 15%, large: 13% with constraints
  const screenSizeMultiplier = screenWidth < 400 ? 0.17 : screenWidth < 700 ? 0.15 : 0.13;
  const itemSize = Math.max(60, Math.min(screenWidth * screenSizeMultiplier, 120));
  const cardSpacing = Math.max(6, Math.min(screenWidth * 0.015, 12));
  
  // Calculate visible window and fade zone widths
  const contentPadding = 120; // Total padding (60px on each side)
  const visibleWidth = screenWidth - contentPadding;
  const fadeZoneWidth = visibleWidth * 0.2; // 20% of visible width for fading

  // Calculate total content width
  const totalContentWidth = captures.length * (itemSize + cardSpacing) - cardSpacing + contentPadding;
  // Calculate maximum scroll offset
  const maxOffsetX = Math.max(0, totalContentWidth - screenWidth);
  
  // For tracking scroll position
  const scrollX = useRef(new Animated.Value(0)).current;
  
  // Set initial scroll position when expanded
  useEffect(() => {
    if (isCardsExpanded && scrollViewRef.current && captures.length > 0) {
      setTimeout(() => {
        scrollViewRef.current.scrollTo({ x: 0, animated: false });
        scrollX.setValue(0);
      }, 100);
    }
  }, [isCardsExpanded]);
  
  // Handle scrolling to update animation value
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );
  
  // Function to scroll left/right - updated to respect content bounds
  const scrollInDirection = (direction) => {
    if (!scrollViewRef.current) return;

    // Get current scroll position directly from Animated value for accuracy
    const currentX = scrollX._value || 0;
    // Calculate the amount to scroll (e.g., two items)
    const scrollAmount = (itemSize + cardSpacing) * 2;

    let newX;
    if (direction === 'left') {
      newX = Math.max(0, currentX - scrollAmount);
    } else { // direction === 'right'
      newX = Math.min(maxOffsetX, currentX + scrollAmount); // Clamp to maxOffsetX
    }

    // Scroll to new position
    scrollViewRef.current.scrollTo({
      x: newX,
      animated: true
    });
  };
  
  return (
    <View style={{
      position: 'absolute',
      bottom: 10,
      left: isCardsExpanded ? 0 : 20,
      width: isCardsExpanded ? '100%' : 180,
      height: isCardsExpanded ? itemSize + 30 : 130, // Adjust height based on card size
      zIndex: 100,
    }}>
      {/* Close button */}
      {isCardsExpanded && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: -10,
            right: 10,
            backgroundColor: 'rgba(0, 0, 0, 0.0)',
            width: 20,
            height: 20,
            borderRadius: 14,
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 200,
          }}
          onPress={toggleCardGroup}
        >
          <Text style={{ color: 'white', fontSize: 14, fontWeight: 'bold' }}>✕</Text>
        </TouchableOpacity>
      )}
      
      {!isCardsExpanded ? (
        /* Compact mode */
        captures && captures.length > 0 ? (
          <CardStack 
            captures={captures} 
            toggleCardGroup={toggleCardGroup} 
            dimensions={dimensions}
          />
        ) : null
      ) : (
        /* Expanded mode */
        <View style={{ width: '100%', height: '100%' }}>
          {/* Main ScrollView containing the cards - simplified for reliable scrolling */}
          <ScrollView
            ref={scrollViewRef}
            horizontal={true}
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: contentPadding / 2,
              alignItems: 'center',
              paddingVertical: 15,
            }}
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            decelerationRate="normal"
            scrollEnabled={true}  // This is critical
          >
            {captures && captures.map((capture, index) => {
              // Calculate this card's absolute position in the ScrollView
              const cardPosition = index * (itemSize + cardSpacing);
              
              // Create a derived animated value that represents this card's position in the viewport
              const cardViewportPosition = Animated.subtract(cardPosition, scrollX);
              
              // Define the fade zones relative to the viewport - adjusted for better visibility on both sides
              const leftFadeZoneStart = -itemSize * 1.0; // Start fade when card is halfway off-screen
              const leftFadeZoneEnd = -contentPadding * 0.2; // End fade at 1/4 of the padding (smaller fade zone)
              
              // Right fade zone - start fade earlier
              const rightFadeZoneStart = screenWidth - contentPadding/2 - itemSize - fadeZoneWidth * 1.0; // Start fade zone much earlier
              const rightFadeZoneEnd = screenWidth - contentPadding/2 - itemSize * 1.0; // End fade with 30% of card still visible
              
              // Create opacity interpolation based on the card's position in the viewport
              const cardOpacity = cardViewportPosition.interpolate({
                inputRange: [
                  leftFadeZoneStart,  // When card is partially off the left edge
                  leftFadeZoneEnd,    // When card is past left fade zone (smaller zone)
                  rightFadeZoneStart, // When card enters right fade zone
                  rightFadeZoneEnd    // When card is at right edge
                ],
                outputRange: [0, 1, 1, 0],
                extrapolate: 'clamp'
              });
              
              return (
                <Animated.View 
                  key={index}
                  style={{
                    marginRight: cardSpacing,
                    opacity: cardOpacity,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      console.log('Card pressed at index:', index);
                      expandCard(index);
                    }}
                    activeOpacity={0.7}
                    style={{
                      width: itemSize,
                      height: itemSize,
                      backgroundColor: 'transparent',
                      borderRadius: Math.max(8, Math.min(14, itemSize * 0.12)), // Responsive border radius
                      overflow: 'hidden',
                      shadowColor: 'transparent',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.3,
                      shadowRadius: 2,
                      elevation: 5,
                    }}
                  >
                    <Image
                      source={{ uri: capture.uri }}
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: Math.max(6, Math.min(12, itemSize * 0.1)), // Responsive inner border radius
                      }}
                      resizeMode="cover"
                    />
                    
                    {/* Add analysis indicator */}
                    {capture.analyzed && (
                      <View style={{
                        position: 'absolute',
                        top: 5,
                        right: 5,
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        backgroundColor: 'rgba(46, 204, 113, 0.85)',
                        borderWidth: 1,
                        borderColor: 'white',
                      }} />
                    )}
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </ScrollView>
          
          {/* Add visual swipe indicator */}
          <View style={{
            position: 'absolute',
            bottom: 5,
            left: 0,
            right: 0,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Text style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: 12,
              fontStyle: 'italic'
            }}></Text>
          </View>
          
          {/* Left arrow - with better styling */}
          <TouchableOpacity
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              marginTop: -20,
              width: 40,
              height: 40,
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 150,
              backgroundColor: 'rgba(0,0,0,0.3)',
              borderRadius: 20,
            }}
            onPress={() => scrollInDirection('left')}
          >
            <Text style={{ top:-4, color: 'white', fontSize: 24, fontWeight: 'bold' }}>←</Text>
          </TouchableOpacity>
          
          {/* Right arrow - with better styling */}
          <TouchableOpacity
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              marginTop: -20,
              width: 40,
              height: 40,
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 150,
              backgroundColor: 'rgba(0,0,0,0.3)',
              borderRadius: 20,
            }}
            onPress={() => scrollInDirection('right')}
          >
            <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>→</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default CardGroup;