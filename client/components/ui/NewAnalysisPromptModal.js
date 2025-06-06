import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const NewAnalysisPromptModal = ({ visible, onClose, onSubmit, captures = [] }) => {
  const [prompt, setPrompt] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const { width, height } = useWindowDimensions();

  // Reset selected images when modal opens or captures change
  useEffect(() => {
    if (visible && captures.length > 0) {
      const validCaptures = captures.filter(
        capture => capture && capture.uri && typeof capture.uri === 'string'
      );
      setSelectedImages(validCaptures.map(capture => capture.uri));
    }
  }, [visible, captures]);

  // Image selection functions
  const toggleImageSelection = (imageUri) => {
    setSelectedImages(prev =>
      prev.includes(imageUri)
        ? prev.filter(uri => uri !== imageUri)
        : [...prev, imageUri]
    );
  };

  const selectAllImages = () => {
    const validCaptures = captures.filter(
      capture => capture && capture.uri && typeof capture.uri === 'string'
    );
    setSelectedImages(validCaptures.map(capture => capture.uri));
  };

  const selectNoImages = () => setSelectedImages([]);

  // Handle form submission
  const handleSubmit = () => {
    const validCaptures = captures.filter(
      capture => capture && capture.uri && typeof capture.uri === 'string'
    );
    const selectedCaptures = validCaptures.filter(capture =>
      selectedImages.includes(capture.uri)
    );
    onSubmit(prompt, selectedCaptures);
    setPrompt('');
    setSelectedImages(validCaptures.map(capture => capture.uri));
    onClose();
  };

  // Sub-component for rendering each image item
  const ImageItem = ({ capture, index }) => (
    <TouchableOpacity
      style={[
        styles.imageItem,
        (index + 1) % 3 === 0 ? styles.imageItemLast : null,
      ]}
      onPress={() => toggleImageSelection(capture.uri)}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.imageContainer,
          selectedImages.includes(capture.uri)
            ? styles.selectedImageContainer
            : null,
        ]}
      >
        <Image
          source={{ uri: capture.uri }}
          style={styles.imagePreview}
          resizeMode="cover"
        />
        <View
          style={[
            styles.checkbox,
            selectedImages.includes(capture.uri)
              ? styles.checkedBox
              : null,
          ]}
        >
          {selectedImages.includes(capture.uri) && (
            <Ionicons name="checkmark" size={14} color="white" />
          )}
        </View>
        {capture.analyzed && (
          <View style={styles.analyzedBadge}>
            <Ionicons name="checkmark-circle" size={12} color="#4CAF50" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (!visible) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={0.7}
            onPress={onClose}
          />
          <View
            style={[
              styles.modalContainer,
              {
                width: Math.min(width * 0.9, 450),
                maxHeight: Platform.OS === 'android' ? height * 0.95 : height * 0.85,
                minHeight: Platform.OS === 'android' ? Math.min(height * 0.8, 600) : Math.min(height * 0.6, 400)
              }
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>New Deep Analysis</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.content}>
              <Text style={styles.subtitle}>
                Enter a specific prompt to analyze your selected images:
              </Text>
              <TextInput
                style={styles.input}
                placeholder="E.g., What historical period do these items belong to?"
                value={prompt}
                onChangeText={setPrompt}
                multiline={true}
                numberOfLines={4}
                textAlignVertical="top"
                autoFocus={true}
                placeholderTextColor="#999"
              />

              {/* Image Selection */}
              <View
                style={[
                  styles.imageSelectionContainer,
                  Platform.OS === 'android' ? { flex: 1, minHeight: 200 } : {}
                ]}
              >
                <View style={styles.selectionHeader}>
                  <Text style={styles.selectionTitle}>
                    Select Images ({selectedImages.length}/{captures.length})
                  </Text>
                  <View style={styles.selectionButtons}>
                    <TouchableOpacity
                      style={styles.selectionButton}
                      onPress={selectAllImages}
                    >
                      <Text style={styles.selectionButtonText}>All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.selectionButton}
                      onPress={selectNoImages}
                    >
                      <Text style={styles.selectionButtonText}>None</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <ScrollView
                  style={[
                    styles.imageGrid,
                    Platform.OS === 'android' ? { 
                      maxHeight: Math.min(height * 0.4, 150),
                      flex: 1 
                    } : {}
                  ]}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                >
                  <View style={styles.imageGridContent}>
                    {captures.length === 0 ? (
                      <View style={styles.noImagesContainer}>
                        <Text style={styles.noImagesText}>
                          No images available. Please add some images to analyze.
                        </Text>
                      </View>
                    ) : (
                      captures
                        .filter(
                          capture =>
                            capture &&
                            capture.uri &&
                            typeof capture.uri === 'string'
                        )
                        .map((capture, index) => (
                          <ImageItem
                            key={capture.uri || `capture-${index}`}
                            capture={capture}
                            index={index}
                          />
                        ))
                    )}
                  </View>
                </ScrollView>
              </View>

              {/* Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={onClose}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.submitButton,
                    selectedImages.length === 0 ? styles.disabledButton : null,
                  ]}
                  onPress={handleSubmit}
                  disabled={selectedImages.length === 0}
                >
                  <Text style={styles.submitButtonText}>
                    {selectedImages.length === 0
                      ? 'Select Images to Analyze'
                      : `Analyze ${selectedImages.length} ${
                          selectedImages.length === 1 ? 'Image' : 'Images'
                        }`}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingView: { flex: 1 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 5,
    ...(Platform.OS === 'web' ? { boxShadow: '0px 4px 12px rgba(0,0,0,0.2)' } : {}),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#6A1B9A',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  closeButton: { padding: 4 },
  content: {
    padding: 16,
    flex: 1,
    minHeight: 0,
  },
  subtitle: {
    fontSize: 14,
    color: '#555',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    marginBottom: 20,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f9f9f9',
  },
  imageSelectionContainer: {
    marginBottom: 20,
    flex: 1,
    minHeight: 0,
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  selectionButtons: {
    flexDirection: 'row',
  },
  selectionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    marginLeft: 8,
  },
  selectionButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  imageGrid: {
    maxHeight: 280,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    backgroundColor: '#fafafa',
    flex: 1,
    minHeight: 0,
  },
  imageGridContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    paddingBottom: 12,
  },
  imageItem: {
    width: '31%',
    aspectRatio: 1,
    marginRight: '3.5%',
    marginBottom: 8,
  },
  imageItemLast: {
    marginRight: 0,
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  selectedImageContainer: {
    borderColor: '#6A1B9A',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  checkbox: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkedBox: {
    backgroundColor: '#6A1B9A',
  },
  analyzedBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8,
    padding: 2,
  },
  noImagesContainer: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    width: '100%',
  },
  noImagesText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 10,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  submitButton: {
    backgroundColor: '#6A1B9A',
  },
  disabledButton: {
    backgroundColor: '#c7b3d4',
  },
  cancelButtonText: {
    color: '#555',
    fontWeight: '500',
  },
  submitButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default NewAnalysisPromptModal;