import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Modal, 
  StyleSheet, 
  ActivityIndicator, 
  ScrollView,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const DeepAnalysisDialog = ({ 
  visible, 
  onClose, 
  onSubmit, 
  isLoading, 
  captureCount = 0 
}) => {
  const [prompt, setPrompt] = useState('');
  
  const handleSubmit = () => {
    onSubmit(prompt);
  };
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Deep Analysis</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalBody}>
            <Text style={styles.promptLabel}>
              Write a custom prompt for analyzing {captureCount} images together:
            </Text>
            
            <TextInput
              style={styles.promptInput}
              placeholder="e.g., Analyze the historical significance of these locations..."
              placeholderTextColor="#999"
              multiline={true}
              numberOfLines={4}
              value={prompt}
              onChangeText={setPrompt}
              editable={!isLoading}
            />
            
            <Text style={styles.helpText}>
              This will use Perplexity's deep research model to analyze all your images together as a collection.
            </Text>
          </View>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
              <TouchableOpacity 
              style={[
                styles.button, 
                styles.submitButton,
                (isLoading || captureCount === 0) ? styles.disabledButton : null
              ]}
              onPress={handleSubmit}
              disabled={isLoading || captureCount === 0}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonText}>Analyze</Text>
              )}
            </TouchableOpacity>
          </View>
          
          {captureCount === 0 && (
            <Text style={styles.errorText}>
              You need at least one captured image to perform analysis.
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.85,
    maxWidth: 500,
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  modalBody: {
    padding: 20,
  },
  promptLabel: {
    fontSize: 16,
    marginBottom: 10,
    color: '#333',
  },
  promptInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    color: '#333',
    backgroundColor: '#f9f9f9',
  },
  helpText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  cancelButton: {
    backgroundColor: '#f2f2f2',
    marginRight: 10,
  },
  submitButton: {
    backgroundColor: '#4285F4',
  },
  disabledButton: {
    backgroundColor: '#a6c8ff',
    opacity: 0.7,
  },
  buttonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 15,
    fontSize: 14,
  },
});

export default DeepAnalysisDialog;
