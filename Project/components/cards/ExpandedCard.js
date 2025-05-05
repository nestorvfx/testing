import React from 'react';
import { View, Text, Image, TouchableOpacity, Dimensions, ScrollView, StyleSheet, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ExpandedCard = ({ capture, dimensions, collapseCard }) => {
  if (!capture) return null;
  
  // Calculate card dimensions
  const screenWidth = dimensions?.width || Dimensions.get('window').width;
  const screenHeight = dimensions?.height || Dimensions.get('window').height;
  
  // Card sizing
  const baseWidth = screenWidth * 0.85;
  const targetHeight = (baseWidth * 16) / 9;
  const maxHeight = screenHeight * 0.85;
  const cardHeight = Math.min(targetHeight, maxHeight);
  const cardWidth = targetHeight > maxHeight ? (maxHeight * 9) / 16 : baseWidth;
  
  // Check if the card has analysis data
  const isAnalyzed = capture.analyzed && capture.analysis;
  
  return (
    <View style={styles.modalOverlay}>
      {/* Background overlay for dismissal */}
      <TouchableOpacity 
        style={styles.dismissOverlay}
        activeOpacity={0.7}
        onPress={(e) => {
          // Only dismiss if the touch is on the backdrop
          if (e.target === e.currentTarget) {
            collapseCard();
          }
        }}
      />
      
      {/* Card container - no touchable wrapper to allow scrolling */}
      <View style={[styles.cardContainer, { width: cardWidth, height: cardHeight }]}>
        {/* Card image - takes up 40% of the card for analyzed cards, 65% otherwise */}
        <View style={[styles.imageContainer, { height: isAnalyzed ? '40%' : '65%' }]}>
          <Image 
            source={{ uri: capture.uri }} 
            style={styles.image}
          />
          
          {/* Analysis badge */}
          {isAnalyzed && (
            <View style={styles.analysisBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#fff" />
              <Text style={styles.analysisBadgeText}>Analyzed</Text>
            </View>
          )}
          
          {/* Custom prompt badge */}
          {capture.customPrompt && (
            <View style={[styles.analysisBadge, styles.promptBadge]}>
              <Ionicons name="mic" size={14} color="#fff" />
              <Text style={styles.analysisBadgeText}>Voice Prompt</Text>
            </View>
          )}
        </View>
        
        {/* Card content */}
        <View style={styles.contentContainer}>
          {isAnalyzed ? (
            <ScrollView 
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16 }}
              showsVerticalScrollIndicator={true}
              alwaysBounceVertical={true}
              scrollEventThrottle={16}
              directionalLockEnabled={true}
              removeClippedSubviews={false}
              overScrollMode="always"
            >
              <Text style={styles.title}>
                {capture.analysis.title}
              </Text>
              
              {/* Display custom prompt if available */}
              {capture.customPrompt && (
                <View style={styles.promptContainer}>
                  <Text style={styles.promptLabel}>Voice Prompt:</Text>
                  <Text style={styles.promptText}>"{capture.customPrompt}"</Text>
                </View>
              )}
              
              <Text style={styles.description}>
                {capture.analysis.description}
              </Text>
              
              {capture.analysis.keyPoints && capture.analysis.keyPoints.length > 0 && (
                <View style={styles.keyPointsContainer}>
                  <Text style={styles.keyPointsTitle}>Key Points:</Text>
                  {capture.analysis.keyPoints.map((point, index) => (
                    <View key={index} style={styles.keyPointItem}>
                      <Text style={styles.keyPointBullet}>•</Text>
                      <Text style={styles.keyPointText}>{point}</Text>
                    </View>
                  ))}
                </View>
              )}
              
              {capture.analysis.reference && (
                <View style={styles.referenceContainer}>
                  <Text style={styles.referenceLabel}>Reference: </Text>
                  <Text style={styles.referenceText}>{capture.analysis.reference}</Text>
                </View>
              )}
              
              <Text style={styles.timestamp}>
                Analyzed on {new Date(capture.analysisDate).toLocaleString()}
              </Text>
              
              {/* Extra padding at bottom */}
              <View style={{ height: 40 }} />
            </ScrollView>
          ) : (
            <View style={styles.noAnalysisContainer}>
              <Text style={styles.noAnalysisTitle}>Scene Capture</Text>
              
              {/* Display custom prompt if available */}
              {capture.customPrompt && (
                <View style={styles.promptContainerNoAnalysis}>
                  <Text style={styles.promptLabelNoAnalysis}>Voice Prompt:</Text>
                  <Text style={styles.promptTextNoAnalysis}>"{capture.customPrompt}"</Text>
                </View>
              )}
              
              <Text style={styles.noAnalysisText}>
                This image hasn't been analyzed yet. Use the "Analyze" button to get insights about this image.
              </Text>
              <Text style={styles.captureTimestamp}>
                Captured on {new Date(capture.timestamp).toLocaleString()}
              </Text>
            </View>
          )}
        </View>
        
        {/* Close button */}
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={collapseCard}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    zIndex: 2000,
    elevation: 2
  },
  dismissOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 2001,
  },
  cardContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 2002,
  },
  imageContainer: {
    width: '100%',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  analysisBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(46, 204, 113, 0.85)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  analysisBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#444',
    marginBottom: 12,
  },
  keyPointsContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  keyPointsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  keyPointItem: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 4,
  },
  keyPointBullet: {
    fontSize: 15,
    color: '#4285F4',
    marginRight: 6,
  },
  keyPointText: {
    fontSize: 14,
    color: '#555',
    flex: 1,
    lineHeight: 20,
  },
  referenceContainer: {
    marginTop: 10,
  },
  referenceLabel: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#333',
  },
  referenceText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  timestamp: {
    fontSize: 12,
    color: '#888',
    marginTop: 12,
    textAlign: 'right',
  },
  noAnalysisContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  noAnalysisTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  noAnalysisText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  captureTimestamp: {
    fontSize: 12,
    color: '#888',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2003,
  },
  closeButtonText: {
    color: 'white', 
    fontSize: 16, 
    fontWeight: 'bold',
  },
  promptBadge: {
    backgroundColor: 'rgba(233, 30, 99, 0.85)',
    top: 12,
    right: 120,
  },
  promptContainer: {
    backgroundColor: 'rgba(233, 30, 99, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#e91e63',
  },
  promptLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#e91e63',
    marginBottom: 4,
  },
  promptText: {
    fontSize: 15,
    fontStyle: 'italic',
    color: '#333',
  },
  promptContainerNoAnalysis: {
    backgroundColor: 'rgba(233, 30, 99, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    marginHorizontal: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#e91e63',
  },
  promptLabelNoAnalysis: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#e91e63',
    marginBottom: 4,
  },
  promptTextNoAnalysis: {
    fontSize: 15,
    fontStyle: 'italic',
    color: '#333',
  },
});

export default ExpandedCard;
