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
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const NewAnalysisPromptModal = ({ visible, onClose, onSubmit, imagesCount }) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = () => {
    onSubmit(prompt);
    setPrompt(''); // Clear prompt after submit
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
                Enter a specific prompt to analyze {imagesCount} {imagesCount === 1 ? 'image' : 'images'}:
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
              
              <View style={styles.buttonContainer}>
                <TouchableOpacity 
                  style={[styles.button, styles.cancelButton]} 
                  onPress={onClose}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.button, styles.submitButton]} 
                  onPress={handleSubmit}
                >
                  <Text style={styles.submitButtonText}>Begin Analysis</Text>
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
    width: Math.min(width * 0.9, 400),
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
