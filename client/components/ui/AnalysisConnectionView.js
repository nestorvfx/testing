import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, useWindowDimensions, Platform } from 'react-native';

const AnalysisConnectionView = ({ images, title, customPrompt }) => {
  const { width, height } = useWindowDimensions();
  const scrollViewRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollStart, setScrollStart] = useState(0);

  const widthBasedSize = (width / 3 - 20) * 0.5;
  const maxHeightConstraint = height / 3;
  const imageSize = Math.min(widthBasedSize, maxHeightConstraint);
  const displayImages = images || [];

  // Web mouse event handlers
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartX(e.nativeEvent.clientX);
    setScrollStart(scrollViewRef.current?.scrollLeft || 0);
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const deltaX = e.nativeEvent.clientX - startX;
    scrollViewRef.current.scrollLeft = scrollStart - deltaX;
    e.preventDefault();
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      
      {customPrompt && (
        <View style={styles.promptContainer}>
          <Text style={styles.promptText}>"{customPrompt}"</Text>
        </View>
      )}
      
      {displayImages.length > 0 ? (
        <View style={styles.scrollViewContainer}>
          <ScrollView 
            ref={scrollViewRef}
            horizontal={true}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            scrollEventThrottle={16}
            decelerationRate="normal"
            snapToAlignment="center"
            directionalLockEnabled={true}
            style={Platform.OS === 'web' ? [
              styles.webScrollView,
              { cursor: isDragging ? 'grabbing' : 'grab' }
            ] : {}}
            {...(Platform.OS === 'web' && {
              onMouseDown: handleMouseDown,
              onMouseMove: handleMouseMove,
              onMouseUp: handleMouseUp,
              onMouseLeave: handleMouseUp,
            })}
          >
            {displayImages.map((image, index) => (              <View 
                key={index} 
                style={[
                  styles.imageContainer,
                  Platform.OS === 'web' ? styles.webImageContainer : null
                ]}
              >
                <Image 
                  source={{ uri: image.uri }} 
                  style={[
                    styles.image, 
                    { width: imageSize, height: imageSize },
                    Platform.OS === 'web' ? styles.webImage : null
                  ]} 
                />
              </View>
            ))}
          </ScrollView>
          
          <Text style={styles.scrollHintText}>← Swipe →</Text>
        </View>
      ) : (
        <View style={styles.noImagesContainer}>
          <Text style={styles.noImagesText}>No images in this analysis</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  promptContainer: {
    backgroundColor: '#e8f4fd',
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
  },
  promptText: {
    fontStyle: 'italic',
    color: '#2980b9',
  },
  scrollViewContainer: {
    marginVertical: 8,
    ...(Platform.OS === 'web' ? {
      userSelect: 'none',
      WebkitUserSelect: 'none',
      msUserSelect: 'none',
      MozUserSelect: 'none',
    } : {})
  },
  webScrollView: {
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'thin',
    msOverflowStyle: 'auto',
    WebkitAppearance: 'none',
    pointerEvents: 'auto',
  },
  scrollContent: {
    paddingVertical: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
  },
  imageContainer: {
    marginHorizontal: 8,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  webImageContainer: {
    pointerEvents: 'none',
  },
  image: {
    borderRadius: 6,
  },
  webImage: {
    pointerEvents: 'none',
    userDrag: 'none',
    WebkitUserDrag: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
  noImagesContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
  },
  noImagesText: {
    color: '#999',
    fontStyle: 'italic',
  },
  scrollHintText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  }
});

export default AnalysisConnectionView;