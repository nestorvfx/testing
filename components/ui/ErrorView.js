import React from 'react';
import { View, Text } from 'react-native';
import { styles } from '../../styles';

const ErrorView = ({ error }) => (
  <View style={styles.errorContainer}>
    <Text style={styles.errorText}>Camera Error: {error?.message || 'Unknown error'}</Text>
  </View>
);

export default ErrorView;
