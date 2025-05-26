import React, { useState } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  Dimensions,
  ScrollView,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const NewAnalysisPromptModal = ({ visible, onClose, onSubmit, captures = [] }) => {
  const [prompt, setPrompt] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);

  // Reset selected images when modal becomes visible or captures change
  React.useEffect(() => {
    if (visible && captures.length > 0) {
      setSelectedImages(captures.map(capture => capture.uri));
    }
  }, [visible, captures]);
  const toggleImageSelection = (imageUri) => {
    setSelectedImages(prev => {
      if (prev.includes(imageUri)) {
        return prev.filter(uri => uri !== imageUri);
      } else {
        return [...prev, imageUri];
      }
    });
  };

  const selectAllImages = () => {
    setSelectedImages(captures.map(capture => capture.uri));
  };

  const selectNoImages = () => {
    setSelectedImages([]);
  };

  const handleSubmit = () => {
    // Get the selected capture objects
    const selectedCaptures = captures.filter(capture => 
      selectedImages.includes(capture.uri)
    );
    onSubmit(prompt, selectedCaptures);
    setPrompt(''); // Clear prompt after submit
    setSelectedImages(captures.map(capture => capture.uri)); // Reset to all selected
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={0.7} onPress={onClose} />
          
          <View style={styles.modalContainer}>
            <View style={styles.header}>
              <Text style={styles.title}>New Deep Analysis</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
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

              {/* Image Selection Section */}
              <View style={styles.imageSelectionContainer}>
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
                </View>                <ScrollView 
                  style={styles.imageGrid}
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
                      captures.map((capture, index) => (
                        <TouchableOpacity
                          key={capture.uri}
                          style={[
                            styles.imageItem,
                            (index + 1) % 3 === 0 && styles.imageItemLast // Remove margin on every 3rd item
                          ]}
                          onPress={() => toggleImageSelection(capture.uri)}
                          activeOpacity={0.7}
                        >
                          <View style={[
                            styles.imageContainer,
                            selectedImages.includes(capture.uri) && styles.selectedImageContainer
                          ]}>
                            <Image 
                              source={{ uri: capture.uri }} 
                              style={styles.imagePreview}
                              resizeMode="cover"
                            />
                            <View style={[
                              styles.checkbox,
                              selectedImages.includes(capture.uri) && styles.checkedBox
                            ]}>
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
                      ))
                    )}
                  </View>
                </ScrollView>
              </View>
              
              <View style={styles.buttonContainer}>
                <TouchableOpacity 
                  style={[styles.button, styles.cancelButton]} 
                  onPress={onClose}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>                <TouchableOpacity 
                  style={[
                    styles.button, 
                    styles.submitButton,
                    selectedImages.length === 0 && styles.disabledButton
                  ]} 
                  onPress={handleSubmit}
                  disabled={selectedImages.length === 0}
                >
                  <Text style={styles.submitButtonText}>
                    {selectedImages.length === 0 
                      ? 'Select Images to Analyze' 
                      : `Analyze ${selectedImages.length} ${selectedImages.length === 1 ? 'Image' : 'Images'}`
                    }
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
  keyboardAvoidingView: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    width: Math.min(width * 0.9, 450), // Slightly wider to accommodate image grid
    maxHeight: '85%', // Limit height to allow scrolling
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
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 16,
    flex: 1,
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
  },  selectionButtons: {
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
    maxHeight: 200, // Limit height for scrolling
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    backgroundColor: '#fafafa',
  },  imageGridContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },  imageItem: {
    width: '30%', // 3 columns with gaps
    aspectRatio: 1,
    marginRight: '3.33%', // Add margin for spacing
    marginBottom: 8,
  },
  imageItemLast: {
    marginRight: 0, // Remove margin on last item in row
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
  },
  noImagesText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
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
  }
});

export default NewAnalysisPromptModal;
