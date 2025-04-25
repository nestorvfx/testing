import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Linking, 
  Dimensions 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const DeepAnalysisResults = ({ results, onClose }) => {
  if (!results) return null;
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Deep Analysis Results</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.content}>
        <Text style={styles.title}>{results.title}</Text>
        
        <Text style={styles.description}>{results.description}</Text>
        
        {results.keyPoints && results.keyPoints.length > 0 && (
          <View style={styles.keyPointsContainer}>
            <Text style={styles.sectionTitle}>Key Points:</Text>
            {results.keyPoints.map((point, index) => (
              <View key={index} style={styles.keyPointItem}>
                <Text style={styles.bulletPoint}>•</Text>
                <Text style={styles.keyPointText}>{point}</Text>
              </View>
            ))}
          </View>
        )}
        
        {(results.reference || (results.citations && results.citations.length > 0)) && (
          <View style={styles.referencesContainer}>
            <Text style={styles.sectionTitle}>References:</Text>
            
            {results.reference && results.reference !== "N/A" && (
              <Text style={styles.referenceText}>{results.reference}</Text>
            )}
            
            {results.citations && results.citations.map((url, idx) => (
              <TouchableOpacity 
                key={idx}
                onPress={() => Linking.openURL(url)}
                style={styles.citationLink}
              >
                <Ionicons name="link-outline" size={14} color="#4285F4" />
                <Text style={styles.citationLinkText}>
                  {url.replace(/^https?:\/\//, '').split('/')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        
        <View style={styles.metadataContainer}>
          <Text style={styles.metadataText}>
            Analysis performed on {results.imageCount} images • 
            {new Date(results.timestamp).toLocaleString()}
          </Text>
          
          {results.customPrompt && (
            <View style={styles.promptContainer}>
              <Text style={styles.promptLabel}>Custom prompt:</Text>
              <Text style={styles.promptText}>{results.customPrompt}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    width: Math.min(width * 0.9, 400),
    maxHeight: 500,
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#4285F4',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 16,
    maxHeight: 440,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#444',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  keyPointsContainer: {
    marginBottom: 16,
  },
  keyPointItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  bulletPoint: {
    fontSize: 16,
    color: '#4285F4',
    marginRight: 8,
    lineHeight: 22,
  },
  keyPointText: {
    fontSize: 15,
    color: '#555',
    flex: 1,
    lineHeight: 22,
  },
  referencesContainer: {
    marginBottom: 20,
  },
  referenceText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  citationLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(66, 133, 244, 0.1)',
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  citationLinkText: {
    color: '#4285F4',
    fontSize: 13,
    marginLeft: 6,
    textDecorationLine: 'underline',
  },
  metadataContainer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
  metadataText: {
    fontSize: 12,
    color: '#888',
  },
  promptContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  promptLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 4,
  },
  promptText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
});

export default DeepAnalysisResults;
