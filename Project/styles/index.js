import { StyleSheet, Platform } from 'react-native';
import { COMPACT_MAX_WIDTH, CARD_WIDTH, CARD_HEIGHT } from '../constants';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centeredContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
    position: 'relative',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  captureGuide: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#fff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {},
      web: {
        boxShadow: '0px 0px 10px rgba(255, 255, 255, 0.3)',
      }
    }),
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.4)',
      }
    }),
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f44336',
    borderWidth: 3,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  capturingIndicator: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: 'white',
  },
  capturesContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    maxWidth: COMPACT_MAX_WIDTH,
    zIndex: 100,
  },
  capturesScroll: {
    flexDirection: 'row',
  },
  captureImage: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'white',
  },
  cardNavigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 101,
  },
  navigationButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  navigationButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#4285F4',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorDetails: {
    color: '#FF6B6B',
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  errorContainer: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(255, 0, 0, 0.7)',
    padding: 10,
    borderRadius: 8,
    zIndex: 1000,
  },
  errorText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  },
  instructionsContainer: {
    marginTop: 30,
    width: '80%',
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
  },
  instructionsTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  instructionText: {
    color: 'white',
    fontSize: 14,
    marginBottom: 5,
  },
  helpText: {
    color: 'white',
    fontSize: 14,
    marginTop: 15,
    textAlign: 'center',
    paddingHorizontal: 20,
    fontStyle: 'italic',
  },
  compactStackContainer: {
    width: COMPACT_MAX_WIDTH,
    height: CARD_HEIGHT + 10,
    position: 'relative',
  },
  compactCard: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.3)',
      }
    }),
  },
  cardTouchable: {
    width: '100%',
    height: '100%',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'white',
  },
  recordingIndicator: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 5,
  },
  recordingText: {
    color: 'white',
    fontSize: 16,
  },
  initializing: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
  },
  initializingText: {
    color: 'white',
    fontSize: 16,
  },
  photoCountBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f44336', // Red badge
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000, // Ensure it's above all cards
    borderWidth: 1.5,
    borderColor: 'white',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.2)',
      }
    }),
  },
  photoCountText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  platformSpecific: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    android: {
      elevation: 5,
    },
    web: {
      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)',
    },
  }),
});
