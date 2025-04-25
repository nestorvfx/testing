import React from 'react';
import { TouchableOpacity, Text, View, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AnalyzeButton = ({ onPress, isAnalyzing, unanalyzedCount }) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      disabled={isAnalyzing || unanalyzedCount === 0}
    >
      <View style={[
        styles.button,
        { opacity: (unanalyzedCount === 0 && !isAnalyzing) ? 0.6 : 1 }
      ]}>
        {isAnalyzing ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Ionicons name="search" size={22} color="#fff" />
        )}
        <Text style={styles.text}>
          {isAnalyzing 
            ? "Analyzing..." 
            : unanalyzedCount > 0 
              ? `Analyze (${unanalyzedCount})` 
              : "All Analyzed"
          }
        </Text>
      </View>
      
      {unanalyzedCount > 0 && !isAnalyzing && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unanalyzedCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 20,
    left: '3%',
    zIndex: 150,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(66, 133, 244, 0.85)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  text: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 6,
    fontSize: 14,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#f44336',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  }
});

export default AnalyzeButton;
