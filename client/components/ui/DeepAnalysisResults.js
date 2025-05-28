import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Linking, 
  Platform,
  LayoutAnimation,
  ActivityIndicator,
  useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnalysisConnectionView from './AnalysisConnectionView';
import { enableLayoutAnimations } from '../../utils/layoutAnimationUtil';

// Enable LayoutAnimation on Android with proper architecture check
enableLayoutAnimations();

// Header for AnalysisItem
const AnalysisHeader = ({ index, title, isExpanded, onToggle }) => (
  <TouchableOpacity 
    style={styles.analysisHeader} 
    onPress={onToggle}
    activeOpacity={0.7}
    accessibilityLabel={`Toggle analysis ${index + 1}`}
  >
    <View style={styles.headerContent}>
      <Text style={styles.analysisIndex}>{index + 1}</Text>
      <Text 
        style={styles.analysisTitle} 
        numberOfLines={isExpanded ? 0 : 1}
      >
        {title || 'Analysis Result'}
      </Text>
    </View>
    <View style={styles.headerIcons}>
      <Ionicons 
        name={isExpanded ? "chevron-up" : "chevron-down"} 
        size={20} 
        color="#555" 
      />
    </View>
  </TouchableOpacity>
);

// Body for AnalysisItem
const AnalysisBody = ({ analysis }) => {
  const formattedDate = new Date(analysis.timestamp).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <View style={styles.analysisContent}>
      <Text style={styles.timestamp}>
        {formattedDate}
        {analysis.customPrompt ? ' • Custom Analysis' : ''}
      </Text>
      
      {analysis.customPrompt && (
        <View style={styles.promptContainer}>
          <Text style={styles.promptLabel}>Prompt:</Text>
          <Text style={styles.promptText}>{analysis.customPrompt}</Text>
        </View>
      )}
      
      <Text style={styles.description}>{analysis.description}</Text>
      
      {analysis.keyPoints && analysis.keyPoints.length > 0 && (
        <View style={styles.keyPointsContainer}>
          <Text style={styles.sectionTitle}>Key Points:</Text>
          {analysis.keyPoints.map((point, idx) => (
            <View key={idx} style={styles.keyPointItem}>
              <Text style={styles.bulletPoint}>•</Text>
              <Text style={styles.keyPointText}>{point}</Text>
            </View>
          ))}
        </View>
      )}
      
      {(analysis.reference || (analysis.citations && analysis.citations.length > 0)) && (
        <View style={styles.referencesContainer}>
          <Text style={styles.sectionTitle}>References:</Text>
          
          {analysis.reference && analysis.reference !== "N/A" && (
            <Text style={styles.referenceText}>{analysis.reference}</Text>
          )}
          
          {analysis.citations && analysis.citations.map((url, idx) => (
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
          Analysis based on {analysis.imageCount || 'multiple'} {analysis.imageCount === 1 ? 'image' : 'images'}
        </Text>
      </View>
      
      <AnalysisConnectionView
        images={analysis.images}
        customPrompt={analysis.customPrompt}
      />
    </View>
  );
};

// Individual Analysis Item Component
const AnalysisItem = ({ analysis, index, isExpanded, onToggle }) => {
  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggle(index);
  };

  return (
    <View style={[
      styles.analysisItem,
      isExpanded ? styles.analysisItemExpanded : null
    ]}>
      <AnalysisHeader 
        index={index} 
        title={analysis.title} 
        isExpanded={isExpanded} 
        onToggle={toggleExpand} 
      />
      {isExpanded && <AnalysisBody analysis={analysis} />}
    </View>
  );
};

// Header for the modal
const ModalHeader = ({ title, onClose }) => (
  <View style={styles.header}>
    <Text style={styles.headerTitle}>{title}</Text>
    <TouchableOpacity 
      onPress={onClose} 
      style={styles.closeButton}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityLabel="Close modal"
    >
      <Ionicons name="close" size={24} color="white" />
    </TouchableOpacity>
  </View>
);

// Floating Action Button
const FloatingActionButton = ({ onPress }) => (
  <TouchableOpacity 
    style={[
      styles.fab,
      Platform.OS === 'web' ? styles.fabWeb : null
    ]} 
    onPress={onPress}
    accessibilityLabel="Add new analysis"
  >
    <Ionicons name="add" size={28} color="white" />
  </TouchableOpacity>
);

// Loading Overlay
const LoadingOverlay = () => (
  <View style={styles.loadingOverlay}>
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#6A1B9A" />
      <Text style={styles.loadingText}>Analyzing...</Text>
    </View>
  </View>
);

const DeepAnalysisResults = ({ analyses, isAnalyzing, onClose, onAddNewAnalysis }) => {
  const [expandedIndex, setExpandedIndex] = useState(analyses.length > 0 ? analyses.length - 1 : null);
  const { width, height } = useWindowDimensions();

  const widthMultiplier = Platform.OS === 'web' ? 0.92 : 0.85;
  const cardWidth = Math.max(300, Math.min(width * widthMultiplier, Platform.OS === 'web' ? 600 : 500));
  const isLandscape = width > height;
  const cardMaxHeight = Platform.OS === 'android' 
    ? (isLandscape ? height * 0.9 : height * 0.85)
    : (isLandscape ? height * 0.85 : height * 0.8);
  const cardMinHeight = Platform.OS === 'android' 
    ? Math.min(height * 0.7, 500) 
    : Math.min(height * 0.6, 400);

  useEffect(() => {
    if (analyses.length > 0) {
      setExpandedIndex(analyses.length - 1);
    }
  }, [analyses.length]);

  const handleToggle = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <View style={[styles.modalOverlay, { zIndex: 9000 }]}>
      <TouchableOpacity 
        style={[styles.backdrop, { zIndex: 9001 }]}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={[
        styles.container, 
        { 
          width: cardWidth, 
          maxHeight: cardMaxHeight,
          minHeight: cardMinHeight,
          minWidth: Math.min(width * 0.85, 300),
          zIndex: 9002
        },
        Platform.OS === 'web' ? styles.containerWeb : null
      ]}>
        <ModalHeader title={`Deep Analyses (${analyses.length})`} onClose={onClose} />
        {analyses.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No analyses yet</Text>
          </View>
        ) : (
          <ScrollView 
            style={[styles.scrollView, { flex: 1, minHeight: 200 }]}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            {analyses.map((analysis, index) => (
              <AnalysisItem 
                key={analysis.timestamp || index}
                analysis={analysis}
                index={index}
                isExpanded={expandedIndex === index}
                onToggle={handleToggle}
              />
            ))}
            <View style={{ height: 80 }} />
          </ScrollView>
        )}
        {isAnalyzing && <LoadingOverlay />}
        <FloatingActionButton onPress={onAddNewAnalysis} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
    ...(Platform.OS === 'android' ? {
      backgroundColor: 'transparent',
      pointerEvents: 'box-none'
    } : {})
  },
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 9998,
    elevation: 9998,
  },
  container: {
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 9999,
      },
      web: {
        boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.3)',
      }
    }),
    zIndex: 9999,
    ...(Platform.OS === 'android' ? {
      backfaceVisibility: 'hidden',
      transform: [{ perspective: 1000 }]
    } : {}),
    display: 'flex',
    flexDirection: 'column',
  },
  containerWeb: {
    boxShadow: '0px 4px 12px rgba(0,0,0,0.3)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#6A1B9A',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
    minHeight: 200,
  },
  scrollContent: {
    padding: 12,
  },
  analysisItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
    elevation: 2,
    ...(Platform.OS === 'web' ? { boxShadow: '0px 1px 4px rgba(0,0,0,0.1)' } : {}),
  },
  analysisItemExpanded: {
    borderColor: '#6A1B9A',
    borderWidth: 1.5,
  },
  analysisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  analysisIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6A1B9A',
    color: 'white',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: 'bold',
    marginRight: 10,
    fontSize: 14,
  },
  analysisTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  analysisContent: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  timestamp: {
    fontSize: 12,
    color: '#888',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  promptContainer: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  promptLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 4,
  },
  promptText: {
    fontSize: 14,
    color: '#444',
    fontStyle: 'italic',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#444',
    marginBottom: 8,
  },
  keyPointsContainer: {
    marginBottom: 16,
  },
  keyPointItem: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  bulletPoint: {
    marginRight: 8,
    color: '#6A1B9A',
    fontSize: 15,
  },
  keyPointText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#444',
    flex: 1,
  },
  referencesContainer: {
    marginBottom: 16,
  },
  referenceText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  citationLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  citationLinkText: {
    fontSize: 13,
    color: '#4285F4',
    marginLeft: 4,
    textDecorationLine: 'underline',
  },
  metadataContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  metadataText: {
    fontSize: 12,
    color: '#888',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF6F00',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1000000,
    zIndex: 1000000,
  },
  fabWeb: {
    boxShadow: '0px 2px 6px rgba(0,0,0,0.3)',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000001,
    elevation: 1000001,
  },
  loadingContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.2)',
      }
    }),
  },
  loadingText: {
    marginTop: 10,
    color: '#6A1B9A',
    fontWeight: '500',
  }
});

export default DeepAnalysisResults;