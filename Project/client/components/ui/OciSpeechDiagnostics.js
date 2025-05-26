/**
 * OCI Speech Diagnostic Tool Component
 * A utility component for diagnosing OCI Speech authentication issues
 */
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import ociDiagnostics from '../services/ociDiagnostics';

const OciSpeechDiagnostics = () => {
  const [diagnosticResults, setDiagnosticResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null);

  const runDiagnostics = async () => {
    setIsLoading(true);
    try {
      const results = await ociDiagnostics.runAllDiagnostics();
      setDiagnosticResults(results);
    } catch (error) {
      console.error('Error running diagnostics:', error);
      setDiagnosticResults({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const renderStatus = (isSuccess) => (
    <View style={[styles.statusIndicator, { backgroundColor: isSuccess ? '#4CAF50' : '#F44336' }]}>
      <Text style={styles.statusText}>{isSuccess ? 'PASS' : 'FAIL'}</Text>
    </View>
  );

  const renderDetailItem = (label, value, isNested = false) => {
    // Don't render null or undefined values
    if (value === null || value === undefined) return null;
    
    // For boolean values, show ✓ or ✗
    if (typeof value === 'boolean') {
      return (
        <View style={[styles.detailItem, isNested && styles.nestedItem]}>
          <Text style={styles.detailLabel}>{label}:</Text>
          <Text style={[styles.detailValue, { color: value ? '#4CAF50' : '#F44336' }]}>
            {value ? '✓' : '✗'}
          </Text>
        </View>
      );
    }
    
    // For objects, render nested details
    if (typeof value === 'object' && !Array.isArray(value)) {
      return (
        <View style={[styles.detailItem, isNested && styles.nestedItem]}>
          <Text style={styles.detailLabel}>{label}:</Text>
          <View style={styles.nestedContainer}>
            {Object.entries(value).map(([nestedLabel, nestedValue]) => 
              renderDetailItem(nestedLabel, nestedValue, true)
            )}
          </View>
        </View>
      );
    }
    
    // For arrays, join with commas
    if (Array.isArray(value)) {
      return (
        <View style={[styles.detailItem, isNested && styles.nestedItem]}>
          <Text style={styles.detailLabel}>{label}:</Text>
          <Text style={styles.detailValue}>{value.join(', ')}</Text>
        </View>
      );
    }
    
    // Default case for strings and numbers
    return (
      <View style={[styles.detailItem, isNested && styles.nestedItem]}>
        <Text style={styles.detailLabel}>{label}:</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    );
  };

  const renderSection = (title, status, content, sectionKey) => {
    const isExpanded = expandedSection === sectionKey;
    
    return (
      <View style={styles.section}>
        <TouchableOpacity 
          style={styles.sectionHeader} 
          onPress={() => toggleSection(sectionKey)}
        >
          <Text style={styles.sectionTitle}>{title}</Text>
          {status !== undefined && renderStatus(status)}
          <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
        </TouchableOpacity>
        
        {isExpanded && (
          <View style={styles.sectionContent}>
            {content}
          </View>
        )}
      </View>
    );
  };

  const renderClientConfig = () => {
    if (!diagnosticResults?.clientConfiguration) return null;
    
    const { config, validations, speech, allValid } = diagnosticResults.clientConfiguration;
    
    return renderSection(
      'Client Configuration', 
      allValid,
      <View>
        {renderDetailItem('Tenancy', config.tenancy)}
        {renderDetailItem('User', config.user)}
        {renderDetailItem('Region', config.region)}
        {renderDetailItem('Fingerprint', config.fingerprint)}
        {renderDetailItem('Compartment ID', config.compartmentId)}
        {renderDetailItem('Private Key Path', config.privateKeyPath)}
        {renderDetailItem('Public Key Path', config.publicKeyPath)}
        {renderDetailItem('Speech Base URL', speech.baseUrl)}
        {renderDetailItem('WebSocket URL', speech.websocketUrl)}
        {renderDetailItem('Validations', validations)}
      </View>,
      'clientConfig'
    );
  };

  const renderAuthServerTest = () => {
    if (!diagnosticResults?.authServerConnection) return null;
    
    const { success, latency, message, data, error } = diagnosticResults.authServerConnection;
    
    return renderSection(
      'Auth Server Connection',
      success,
      <View>
        {renderDetailItem('Status', success ? 'Connected' : 'Failed')}
        {renderDetailItem('Message', message)}
        {latency && renderDetailItem('Latency', `${latency}ms`)}
        {error && renderDetailItem('Error', error)}
        {data && renderDetailItem('Server Response', data)}
      </View>,
      'authServer'
    );
  };

  const renderIamTest = () => {
    if (!diagnosticResults?.iamPermissions) return null;
    
    const { success, message, data, error } = diagnosticResults.iamPermissions;
    
    return renderSection(
      'IAM Permissions',
      success,
      <View>
        {renderDetailItem('Status', success ? 'Valid' : 'Invalid')}
        {renderDetailItem('Message', message)}
        {error && renderDetailItem('Error', error)}
        {data && renderDetailItem('Identity API Test', data.identityApiTest)}
        {data && renderDetailItem('Conclusion', data.conclusion)}
      </View>,
      'iamPermissions'
    );
  };

  const renderSpeechTokenTest = () => {
    if (!diagnosticResults?.speechToken) return null;
    
    const { success, message, token, websocketUrl, error } = diagnosticResults.speechToken;
    
    return renderSection(
      'Speech Token',
      success,
      <View>
        {renderDetailItem('Status', success ? 'Obtained' : 'Failed')}
        {renderDetailItem('Message', message)}
        {token && renderDetailItem('Token', token)}
        {websocketUrl && renderDetailItem('WebSocket URL', websocketUrl)}
        {error && renderDetailItem('Error', error)}
      </View>,
      'speechToken'
    );
  };

  const renderSummary = () => {
    if (!diagnosticResults?.summary) return null;
    
    const { 
      clientConfigValid, 
      authServerReachable, 
      iamPermissionsValid, 
      speechTokenObtained, 
      overallSuccess 
    } = diagnosticResults.summary;
    
    return renderSection(
      'Diagnostic Summary',
      overallSuccess,
      <View>
        {renderDetailItem('Client Configuration', clientConfigValid)}
        {renderDetailItem('Auth Server Connection', authServerReachable)}
        {renderDetailItem('IAM Permissions', iamPermissionsValid)}
        {renderDetailItem('Speech Token Obtained', speechTokenObtained)}
        {renderDetailItem('Overall Success', overallSuccess)}
        {!overallSuccess && (
          <View style={styles.recommendationContainer}>
            <Text style={styles.recommendationTitle}>Recommendations:</Text>
            <Text style={styles.recommendationText}>
              {!clientConfigValid && '• Verify your OCI configuration values\n'}
              {!authServerReachable && '• Check if the auth server is running on port 3001\n'}
              {!iamPermissionsValid && '• Verify your OCI credentials and IAM policies\n'}
              {!speechTokenObtained && '• Ensure the Speech service is enabled in your tenancy\n'}
              {!speechTokenObtained && '• Verify your compartment has access to the Speech service\n'}
              {!speechTokenObtained && '• Check if your region supports the Speech service\n'}
            </Text>
          </View>
        )}
      </View>,
      'summary'
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>OCI Speech Diagnostics</Text>
      
      <TouchableOpacity 
        style={styles.runButton} 
        onPress={runDiagnostics}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.runButtonText}>Run Diagnostics</Text>
        )}
      </TouchableOpacity>
      
      {diagnosticResults && (
        <View style={styles.timestampContainer}>
          <Text style={styles.timestampText}>
            Last run: {new Date(diagnosticResults.timestamp).toLocaleString()}
          </Text>
        </View>
      )}
      
      <ScrollView style={styles.resultsContainer}>
        {diagnosticResults?.error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Error running diagnostics:</Text>
            <Text style={styles.errorMessage}>{diagnosticResults.error}</Text>
          </View>
        ) : (
          <>
            {renderSummary()}
            {renderClientConfig()}
            {renderAuthServerTest()}
            {renderIamTest()}
            {renderSpeechTokenTest()}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F5F5F5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333333',
  },
  runButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 16,
  },
  runButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  timestampContainer: {
    marginBottom: 16,
  },
  timestampText: {
    fontSize: 12,
    color: '#666666',
  },
  resultsContainer: {
    flex: 1,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#FFEBEE',
    borderRadius: 4,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#D32F2F',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#EEEEEE',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  expandIcon: {
    fontSize: 16,
    color: '#666666',
    marginLeft: 8,
  },
  sectionContent: {
    padding: 16,
  },
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  detailItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  nestedItem: {
    marginLeft: 16,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666666',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#333333',
    flex: 2,
  },
  nestedContainer: {
    flex: 2,
  },
  recommendationContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#E3F2FD',
    borderRadius: 4,
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 8,
  },
  recommendationText: {
    color: '#1976D2',
  },
});

export default OciSpeechDiagnostics;
