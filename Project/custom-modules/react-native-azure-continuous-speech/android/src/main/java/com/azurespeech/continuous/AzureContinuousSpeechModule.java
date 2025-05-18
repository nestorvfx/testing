package com.azurespeech.continuous;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import com.microsoft.cognitiveservices.speech.SpeechConfig;
import com.microsoft.cognitiveservices.speech.SpeechRecognizer;
import com.microsoft.cognitiveservices.speech.audio.AudioConfig;
import com.microsoft.cognitiveservices.speech.ResultReason;
import com.microsoft.cognitiveservices.speech.CancellationDetails;
import com.microsoft.cognitiveservices.speech.CancellationReason;
import com.microsoft.cognitiveservices.speech.CancellationErrorCode;

import java.util.Map;
import java.util.HashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class AzureContinuousSpeechModule extends ReactContextBaseJavaModule {
    private static final String TAG = "AzureContinuousSpeech";
    private final ReactApplicationContext reactContext;

    private SpeechConfig speechConfig;
    private SpeechRecognizer recognizer;
    private MicrophoneStream microphoneStream;
    private AudioConfig audioConfig;
    private boolean isListening = false;
    private boolean isInitialized = false;
    private final ExecutorService executorService = Executors.newCachedThreadPool();

    public AzureContinuousSpeechModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        Log.d(TAG, "AzureContinuousSpeechModule initialized");
    }    @Override
    public String getName() {
        return "AzureContinuousSpeech";
    }

    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();
        constants.put("isAvailable", true);
        return constants;
    }

    @ReactMethod
    public void addListener(String eventName) {
        // Keep track of event listeners
        Log.d(TAG, "Adding listener for " + eventName);
    }

    @ReactMethod
    public void removeListeners(Integer count) {
        // Remove event listeners
        Log.d(TAG, "Removing listeners, count: " + count);
    }

    private void sendEvent(String eventName, WritableMap params) {
        try {
            this.reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
        } catch (Exception e) {
            Log.e(TAG, "Error sending event: " + eventName, e);
        }
    }

    @ReactMethod
    public void initialize(String subscriptionKey, String region, ReadableMap options, Promise promise) {
        try {
            Log.d(TAG, "Initializing Azure Speech SDK with key: " + subscriptionKey.substring(0, 3) + "*** and region: " + region);
            
            // Initialize speech configuration
            speechConfig = SpeechConfig.fromSubscription(subscriptionKey, region);
            
            // Configure speech recognition language
            String language = options != null && options.hasKey("language") ? 
                options.getString("language") : "en-US";
            speechConfig.setSpeechRecognitionLanguage(language);            // Enable continuous recognition with optimized settings
            speechConfig.setProperty("SpeechServiceResponse_PostProcessingOption", "TrueText");
            
            // Configure audio processing for voice recognition
            speechConfig.setProperty("Audio_AudioProcessingOptions", "2"); // Enhanced processing
            
            // Critical properties for Android microphone
            speechConfig.setProperty("SPEECH-AudioSessionCategoryType", "PlayAndRecord");
            speechConfig.setProperty("SPEECH-AudioSessionMode", "VideoRecording");
            
            // Optimized Android audio settings
            speechConfig.setProperty("SPEECH-AudioRecordingGain", "3.0"); // Increased gain
            speechConfig.setProperty("SPEECH-AllowBackgroundAudioProcessing", "1");
            speechConfig.setProperty("SPEECH-AudioRecordingBufferLengthMs", "2000"); // Increased buffer
            speechConfig.setProperty("SPEECH-AudioRecordingDeviceBufferSize", "32768"); // Increased buffer
            speechConfig.setProperty("SPEECH-AudioRecordingNotificationsBufferSize", "65536"); // Increased buffer
            
            // Improved voice detection settings
            speechConfig.setProperty("SPEECH-VoiceDetectionSensitivity", "0.3"); // Slightly increased sensitivity
            speechConfig.setProperty("SPEECH-VoiceDetectionThreshold", "0.2"); // Slightly increased threshold
            
            // Setup continuous recognition parameters
            speechConfig.setProperty("Speech_SegmentationSilenceTimeoutMs", "500");
            speechConfig.setProperty("Speech_EnableAudioLogging", "1");
            speechConfig.setProperty("SpeechServiceConnection_InitialSilenceTimeoutMs", "5000");
            speechConfig.setProperty("SpeechServiceConnection_EndSilenceTimeoutMs", "800");
            
            // Additional speech recognition improvements
            speechConfig.setProperty("SPEECH-KeywordRecognitionEnergyThreshold", "0.5");
            speechConfig.setProperty("SPEECH-KeywordRecognitionSensitivity", "0.4");
            
            // Enhance recognition confidence settings
            speechConfig.setProperty("Speech_RecognizedPhraseConfidenceThreshold", "0.6");
            speechConfig.setProperty("Speech_FilterProfanity", "0");
            
            // Enable detailed recognition results
            speechConfig.setProperty("SPEECH-SegmentationMode", "continuous");
            speechConfig.setProperty("SPEECH-IncompleteSpeechRejectionThreshold", "0.3");
            
            // Initialize microphone stream
            microphoneStream = MicrophoneStream.create();
            if (!microphoneStream.isInitialized()) {
                Log.e(TAG, "Failed to initialize microphone");
                promise.reject("MICROPHONE_ERROR", "Failed to initialize microphone");
                return;
            }
            
            // Create audio config from microphone stream
            audioConfig = AudioConfig.fromStreamInput(microphoneStream);
            
            // Create speech recognizer
            recognizer = new SpeechRecognizer(speechConfig, audioConfig);
            
            // Setup event listeners
            setupRecognitionEventListeners();
            
            isInitialized = true;
            promise.resolve("Initialized Azure Continuous Speech successfully");
        } catch (Exception e) {
            Log.e(TAG, "Error initializing Azure Speech SDK", e);
            promise.reject("INIT_ERROR", "Error initializing: " + e.getMessage());
        }
    }    private void setupRecognitionEventListeners() {        // Fired when speech is recognized
        recognizer.recognized.addEventListener((object, recognitionEventArgs) -> {
            try {
                WritableMap params = Arguments.createMap();
                
                if (recognitionEventArgs.getResult().getReason() == ResultReason.RecognizedSpeech) {
                    String text = recognitionEventArgs.getResult().getText();
                    Log.d(TAG, "Final recognition result: " + text);
                    
                    // Only send results if we have valid text and we're still listening
                    if (text != null && !text.isEmpty() && isListening) {
                        params.putString("value", text);
                        params.putBoolean("isFinal", true);
                        
                        sendEvent("onSpeechResults", params);
                        
                        // Stop then automatically restart for cleaner segmentation
                        try {
                            // Use a shorter timeout for restart to maintain responsiveness
                            Handler handler = new Handler(Looper.getMainLooper());
                            
                            // Stop current recognition
                            recognizer.stopContinuousRecognitionAsync().get();
                            isListening = false;
                            
                            // Wait briefly then restart
                            handler.postDelayed(() -> {
                                try {
                                    if (recognizer != null) {
                                        Log.d(TAG, "Auto-restarting speech recognition after processing final result");
                                        recognizer.startContinuousRecognitionAsync();
                                        isListening = true;
                                        
                                        // Send a new speech start event
                                        WritableMap startParams = Arguments.createMap();
                                        startParams.putString("value", "Session restarted");
                                        sendEvent("onSpeechStart", startParams);
                                    }
                                } catch (Exception e) {
                                    Log.e(TAG, "Error restarting recognition", e);
                                }
                            }, 300); // Reduced from 500ms to 300ms for faster restart
                        } catch (Exception e) {
                            Log.e(TAG, "Error stopping recognition after final result", e);
                            
                            // Try to recover by directly restarting
                            try {
                                recognizer.startContinuousRecognitionAsync();
                                isListening = true;
                            } catch (Exception restartError) {
                                Log.e(TAG, "Failed to restart after error", restartError);
                            }
                        }
                    }
                } else if (recognitionEventArgs.getResult().getReason() == ResultReason.NoMatch) {
                    Log.d(TAG, "No speech recognized");
                    params.putString("value", "");
                    params.putString("error", "No speech recognized");
                    sendEvent("onSpeechError", params);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error handling recognized event", e);
            }
        });// Fired during ongoing speech recognition, providing interim results
        recognizer.recognizing.addEventListener((object, recognitionEventArgs) -> {
            try {
                String text = recognitionEventArgs.getResult().getText();
                // Ensure we're not just getting a single character
                if (text != null && !text.isEmpty()) {
                    Log.d(TAG, "Interim recognition result: " + text);
                    
                    WritableMap params = Arguments.createMap();
                    params.putString("value", text);
                    params.putBoolean("isFinal", false);
                    sendEvent("onSpeechPartialResults", params);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error handling recognizing event", e);
            }
        });
        
        // Fired when the session has started
        recognizer.sessionStarted.addEventListener((object, sessionEventArgs) -> {
            try {
                Log.d(TAG, "Speech recognition session started");
                WritableMap params = Arguments.createMap();
                params.putString("value", "Session started");
                sendEvent("onSpeechStart", params);
            } catch (Exception e) {
                Log.e(TAG, "Error handling session started event", e);
            }
        });
        
        // Fired when the session has stopped
        recognizer.sessionStopped.addEventListener((object, sessionEventArgs) -> {
            try {
                Log.d(TAG, "Speech recognition session stopped");
                WritableMap params = Arguments.createMap();
                params.putString("value", "Session stopped");
                sendEvent("onSpeechEnd", params);
                
                isListening = false;
            } catch (Exception e) {
                Log.e(TAG, "Error handling session stopped event", e);
            }
        });
          // Fired when an error or cancellation occurs
        recognizer.canceled.addEventListener((object, cancellationEventArgs) -> {
            try {
                CancellationDetails details = CancellationDetails.fromResult(cancellationEventArgs.getResult());
                String reason = details.getReason().toString();
                String errorDetails = details.getErrorDetails();
                Log.e(TAG, "Speech recognition canceled: " + reason + ". Details: " + errorDetails);
                
                WritableMap params = Arguments.createMap();
                
                // Provide more detailed error information for debugging
                if (details.getReason() == CancellationReason.Error) {
                    Log.e(TAG, "Recognition error with code: " + details.getErrorCode() + ", details: " + errorDetails);
                    params.putString("error", errorDetails);
                    params.putInt("code", details.getErrorCode().ordinal()); // Use ordinal() for enum to int conversion
                    params.putString("reason", "Error");
                } else {
                    // Handle non-error cancellations (e.g., user stopped)
                    params.putString("error", "Recognition canceled: " + reason);
                    params.putInt("code", details.getReason().ordinal());
                    params.putString("reason", reason);
                }
                
                sendEvent("onSpeechError", params);
                
                isListening = false;
                
                // If cancelled due to a recoverable error, try to restart recognition
                if (details.getReason() == CancellationReason.Error && 
                    details.getErrorCode().ordinal() < 10) {  // Using ordinal() for comparison with int
                    Log.d(TAG, "Attempting to restart recognition after recoverable error");
                    try {
                        // Delay restart by 1 second
                        new android.os.Handler(reactContext.getMainLooper()).postDelayed(() -> {
                            if (recognizer != null) {
                                try {
                                    recognizer.startContinuousRecognitionAsync();
                                    isListening = true;
                                } catch (Exception e) {
                                    Log.e(TAG, "Failed to auto-restart recognition", e);
                                }
                            }
                        }, 1000);
                    } catch (Exception e) {
                        Log.e(TAG, "Error while setting up auto-restart", e);
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Error handling canceled event", e);
            }
        });
    }

    @ReactMethod
    public void start(Promise promise) {
        if (!isInitialized) {
            Log.e(TAG, "Module not initialized");
            promise.reject("NOT_INITIALIZED", "Azure Continuous Speech not initialized");
            return;
        }
        
        if (isListening) {
            Log.d(TAG, "Already listening, ignoring start request");
            promise.resolve("Already listening");
            return;
        }
        
        try {
            Log.d(TAG, "Starting continuous recognition");
            
            // Start continuous recognition in a separate thread
            executorService.submit(() -> {
                try {
                    recognizer.startContinuousRecognitionAsync().get();
                    isListening = true;
                    
                    reactContext.runOnUiQueueThread(() -> {
                        promise.resolve("Started continuous recognition");
                    });
                } catch (Exception e) {
                    Log.e(TAG, "Error starting continuous recognition", e);
                    reactContext.runOnUiQueueThread(() -> {
                        promise.reject("START_ERROR", "Error starting recognition: " + e.getMessage());
                    });
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Error starting continuous recognition", e);
            promise.reject("START_ERROR", "Error starting recognition: " + e.getMessage());
        }
    }

    @ReactMethod
    public void stop(Promise promise) {
        if (!isInitialized) {
            Log.e(TAG, "Module not initialized");
            promise.reject("NOT_INITIALIZED", "Azure Continuous Speech not initialized");
            return;
        }
        
        if (!isListening) {
            Log.d(TAG, "Not listening, ignoring stop request");
            promise.resolve("Not listening");
            return;
        }
        
        try {
            Log.d(TAG, "Stopping continuous recognition");
            
            executorService.submit(() -> {
                try {
                    recognizer.stopContinuousRecognitionAsync().get();
                    isListening = false;
                    
                    reactContext.runOnUiQueueThread(() -> {
                        promise.resolve("Stopped continuous recognition");
                    });
                } catch (Exception e) {
                    Log.e(TAG, "Error stopping continuous recognition", e);
                    reactContext.runOnUiQueueThread(() -> {
                        promise.reject("STOP_ERROR", "Error stopping recognition: " + e.getMessage());
                    });
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Error stopping continuous recognition", e);
            promise.reject("STOP_ERROR", "Error stopping recognition: " + e.getMessage());
        }
    }

    @ReactMethod
    public void destroy(Promise promise) {
        if (!isInitialized) {
            Log.d(TAG, "Module not initialized, nothing to destroy");
            promise.resolve("Not initialized");
            return;
        }
        
        try {
            Log.d(TAG, "Destroying speech recognizer");
            
            if (isListening) {
                // Stop continuous recognition if it's running
                try {
                    recognizer.stopContinuousRecognitionAsync().get();
                    isListening = false;
                } catch (Exception e) {
                    Log.e(TAG, "Error stopping recognition during cleanup", e);
                }
            }
            
            // Cleanup resources
            if (recognizer != null) {
                recognizer.close();
                recognizer = null;
            }
            
            if (microphoneStream != null) {
                microphoneStream.close();
                microphoneStream = null;
            }
            
            if (audioConfig != null) {
                audioConfig.close();
                audioConfig = null;
            }
            
            if (speechConfig != null) {
                speechConfig.close();
                speechConfig = null;
            }
            
            isInitialized = false;
            
            promise.resolve("Successfully destroyed recognizer");
        } catch (Exception e) {
            Log.e(TAG, "Error destroying recognizer", e);
            promise.reject("DESTROY_ERROR", "Error destroying recognizer: " + e.getMessage());
        }
    }
    
    @ReactMethod
    public void isAvailable(Promise promise) {
        try {
            // Check if Azure Speech SDK is available on the device
            Class.forName("com.microsoft.cognitiveservices.speech.SpeechConfig");
            promise.resolve(true);
        } catch (ClassNotFoundException e) {
            Log.e(TAG, "Azure Speech SDK not available", e);
            promise.resolve(false);
        }
    }
}