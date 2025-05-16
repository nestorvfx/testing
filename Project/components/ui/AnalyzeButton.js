import React, { useEffect } from 'react';
import { TouchableOpacity, Text, View, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AnalyzeButton = ({ onPress, isAnalyzing, unanalyzedCount, pendingAnalysisCount }) => {
  // Log detailed information about the counts being passed to this component
  useEffect(() => {
    console.log('\n[RED CIRCLE] AnalyzeButton Render:');
    console.log(`  pendingAnalysisCount: ${pendingAnalysisCount} (Used for the red circle)`);
    console.log(`  unanalyzedCount: ${unanalyzedCount} (Total unanalyzed images)`);
    console.log(`  isAnalyzing: ${isAnalyzing}`);
    console.log('  Note: pendingAnalysisCount should include failed analyses that need retry');
  }, [pendingAnalysisCount, unanalyzedCount, isAnalyzing]);

  // pendingAnalysisCount is the count of images that haven't been sent to analysis yet
  // unanalyzedCount includes both images in analysis queue and pending ones
  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={onPress}
        disabled={pendingAnalysisCount === 0} // Only disable if nothing to analyze
        activeOpacity={0.8}
        style={{ zIndex: 150 }}
      >
        <View style={[
          styles.button,
          { opacity: pendingAnalysisCount === 0 ? 0.6 : 1 }
        ]}>
          {isAnalyzing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="search" size={22} color="#fff" />
          )}
          <Text style={styles.text}>
            {isAnalyzing 
              ? "Analyzing..."
              : pendingAnalysisCount > 0 
                ? `Analyze (${pendingAnalysisCount})` 
                : "All Analyzed"
            }
          </Text>
        </View>
        
        {/* Only show badge when there are pending analyses and not currently analyzing */}
        {pendingAnalysisCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pendingAnalysisCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
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
    elevation: 5,
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
