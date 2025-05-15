import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AnalysisConnectionView = ({ images, title, customPrompt }) => {
  // Get screen dimensions for layout calculations
  const { width } = Dimensions.get('window');
  
  // Calculate the size of the thumbnail images
  const imageSize = width / 4 - 20;
  
  // Filter out images that have been analyzed
  const analyzedImages = images ? images.filter(img => img.analyzed) : [];
  
  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      
      {customPrompt && (
        <View style={styles.promptContainer}>
          <Text style={styles.promptText}>"{customPrompt}"</Text>
        </View>
      )}
      
      <ScrollView 
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {analyzedImages.map((image, index) => (
          <View key={image.uri} style={styles.imageContainer}>
            <Image 
              source={{ uri: image.uri }} 
              style={[styles.image, { width: imageSize, height: imageSize }]} 
            />
            
            {index < analyzedImages.length - 1 && (
              <View style={styles.connectionLine}>
                <Ionicons name="arrow-forward" size={16} color="#555" />
              </View>
            )}
          </View>
        ))}
      </ScrollView>
      
      {analyzedImages.length === 0 && (
        <View style={styles.noImagesContainer}>
          <Text style={styles.noImagesText}>No analyzed images</Text>
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
  scrollContent: {
    paddingVertical: 5,
    alignItems: 'center',
  },
  imageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  image: {
    borderRadius: 6,
    marginRight: 5,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  connectionLine: {
    marginHorizontal: 5,
  },
  noImagesContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noImagesText: {
    color: '#999',
    fontStyle: 'italic',
  }
});

export default AnalysisConnectionView;
