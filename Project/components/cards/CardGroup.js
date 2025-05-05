import React, { useRef, useEffect } from 'react';
import { View, TouchableOpacity, Image, Text, Dimensions, Animated, ScrollView, Platform } from 'react-native';

const CardGroup = ({ 
  isCardsExpanded,
  scrollViewRef,
  captures,
  toggleCardGroup,
  expandCard,
  dimensions
}) => {
  const { width: screenWidth } = Dimensions.get('window');
  
  const screenSizeMultiplier = screenWidth < 400 ? 0.17 : screenWidth < 700 ? 0.15 : 0.13;
  const itemSize = Math.max(60, Math.min(screenWidth * screenSizeMultiplier, 120));
  const cardSpacing = Math.max(6, Math.min(screenWidth * 0.015, 12));
  
  const contentPadding = 120;
  const visibleWidth = screenWidth - contentPadding;
  const fadeZoneWidth = visibleWidth * 0.2;

  const totalContentWidth = captures.length * (itemSize + cardSpacing) - cardSpacing + contentPadding;
  const maxOffsetX = Math.max(0, totalContentWidth - screenWidth);
  
  const scrollX = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    if (isCardsExpanded && scrollViewRef.current && captures.length > 0) {
      setTimeout(() => {
        scrollViewRef.current.scrollTo({ x: 0, animated: false });
        scrollX.setValue(0);
      }, 100);
    }
  }, [isCardsExpanded]);
  
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );
  
  const scrollInDirection = (direction) => {
    if (!scrollViewRef.current) return;

    const currentX = scrollX._value || 0;
    const scrollAmount = (itemSize + cardSpacing) * 2;

    let newX;
    if (direction === 'left') {
      newX = Math.max(0, currentX - scrollAmount);
    } else {
      newX = Math.min(maxOffsetX, currentX + scrollAmount);
    }

    scrollViewRef.current.scrollTo({
      x: newX,
      animated: true
    });
  };
  
  // Platform-specific arrow text positioning
  const arrowTextTop = Platform.OS === 'web' ? -2 : -4.5;
  
  return (
    <View style={{
      position: 'absolute',
      bottom: 10,
      left: isCardsExpanded ? 0 : 20,
      width: isCardsExpanded ? '100%' : 180,
      height: isCardsExpanded ? itemSize + 30 : 130,
      zIndex: 100,
    }}>
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
      
      {isCardsExpanded ? (
        <View style={{ width: '100%', height: '100%' }}>
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
            scrollEnabled={true}
          >
            {captures && captures.map((capture, index) => {
              const cardPosition = index * (itemSize + cardSpacing);
              const cardViewportPosition = Animated.subtract(cardPosition, scrollX);
              
              const leftFadeZoneStart = -itemSize * 1.0;
              const leftFadeZoneEnd = -contentPadding * 0.2;
              const rightFadeZoneStart = screenWidth - contentPadding/2 - itemSize - fadeZoneWidth * 0.8;
              const rightFadeZoneEnd = screenWidth - contentPadding/2 - itemSize * 1.0;
              
              const cardOpacity = cardViewportPosition.interpolate({
                inputRange: [
                  leftFadeZoneStart,
                  leftFadeZoneEnd,
                  rightFadeZoneStart,
                  rightFadeZoneEnd
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
                    onPress={() => expandCard(index)}
                    activeOpacity={0.7}
                    style={{
                      width: itemSize,
                      height: itemSize,
                      backgroundColor: 'transparent',
                      borderRadius: Math.max(8, Math.min(14, itemSize * 0.12)),
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
                        borderRadius: Math.max(6, Math.min(12, itemSize * 0.1)),
                      }}
                      resizeMode="cover"
                    />
                    
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
            <Text style={{ top: arrowTextTop, color: 'white', fontSize: 24, fontWeight: 'bold' }}>←</Text>
          </TouchableOpacity>
          
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
            <Text style={{top: arrowTextTop, color: 'white', fontSize: 24, fontWeight: 'bold' }}>→</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

export default CardGroup;