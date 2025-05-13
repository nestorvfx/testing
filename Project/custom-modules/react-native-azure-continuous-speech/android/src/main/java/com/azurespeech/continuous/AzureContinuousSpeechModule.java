package com.azurespeech.continuous;

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
    }

    @NonNull
    @Override
    public String getName() {
        return "AzureContinuousSpeech";
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
            speechConfig.setSpeechRecognitionLanguage(language);
            
            // Enable continuous recognition
            speechConfig.setProperty("SpeechServiceResponse_PostProcessingOption", "TrueText");
            
            // Configure audio
            speechConfig.setProperty("Audio_AudioProcessingOptions", "2");
            
            // Critical properties for Android microphone
            speechConfig.setProperty("SPEECH-AudioSessionCategoryType", "PlayAndRecord");
            speechConfig.setProperty("SPEECH-AudioSessionMode", "VideoRecording");
            
            // Improved Android audio settings
            speechConfig.setProperty("SPEECH-AudioRecordingGain", "2.0");
            speechConfig.setProperty("SPEECH-AllowBackgroundAudioProcessing", "1");
            speechConfig.setProperty("SPEECH-AudioRecordingBufferLengthMs", "1500");
            speechConfig.setProperty("SPEECH-AudioRecordingDeviceBufferSize", "25600");
            speechConfig.setProperty("SPEECH-AudioRecordingNotificationsBufferSize", "51200");
            
            // Lower voice detection threshold to improve recognition
            speechConfig.setProperty("SPEECH-VoiceDetectionSensitivity", "0.2");
            speechConfig.setProperty("SPEECH-VoiceDetectionThreshold", "0.1");
            
            // Setup continuous recognition
            speechConfig.setProperty("Speech_SegmentationSilenceTimeoutMs", "700");
            
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
    }

    private void setupRecognitionEventListeners() {
        // Fired when speech is recognized
        recognizer.recognized.addEventListener((object, recognitionEventArgs) -> {
            try {
                WritableMap params = Arguments.createMap();
                
                if (recognitionEventArgs.getResult().getReason() == ResultReason.RecognizedSpeech) {
                    String text = recognitionEventArgs.getResult().getText();
                    Log.d(TAG, "Final recognition result: " + text);
                    
                    params.putString("text", text);
                    params.putBoolean("isFinal", true);
                    sendEvent("SpeechRecognized", params);
                } else if (recognitionEventArgs.getResult().getReason() == ResultReason.NoMatch) {
                    Log.d(TAG, "No speech recognized");
                    params.putString("text", "");
                    params.putBoolean("isFinal", true);
                    params.putString("error", "No speech recognized");
                    sendEvent("SpeechRecognized", params);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error handling recognized event", e);
            }
        });
        
        // Fired during ongoing speech recognition, providing interim results
        recognizer.recognizing.addEventListener((object, recognitionEventArgs) -> {
            try {
                String text = recognitionEventArgs.getResult().getText();
                Log.d(TAG, "Interim recognition result: " + text);
                
                WritableMap params = Arguments.createMap();
                params.putString("text", text);
                params.putBoolean("isFinal", false);
                sendEvent("SpeechRecognizing", params);
            } catch (Exception e) {
                Log.e(TAG, "Error handling recognizing event", e);
            }
        });
        
        // Fired when the session has started
        recognizer.sessionStarted.addEventListener((object, sessionEventArgs) -> {
            try {
                Log.d(TAG, "Speech recognition session started");
                WritableMap params = Arguments.createMap();
                params.putString("sessionId", sessionEventArgs.getSessionId());
                sendEvent("SpeechSessionStarted", params);
            } catch (Exception e) {
                Log.e(TAG, "Error handling session started event", e);
            }
        });
        
        // Fired when the session has stopped
        recognizer.sessionStopped.addEventListener((object, sessionEventArgs) -> {
            try {
                Log.d(TAG, "Speech recognition session stopped");
                WritableMap params = Arguments.createMap();
                params.putString("sessionId", sessionEventArgs.getSessionId());
                sendEvent("SpeechSessionStopped", params);
                
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
                params.putString("reason", reason);
                params.putString("errorDetails", errorDetails);
                sendEvent("SpeechCanceled", params);
                
                isListening = false;
            } catch (Exception e) {
                Log.e(TAG, "Error handling canceled event", e);
            }
        });
    }

    @ReactMethod
    public void startContinuousRecognition(Promise promise) {
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
            
            // Start the microphone recording
            microphoneStream.startRecording();
            
            // Start continuous recognition in a separate thread
            executorService.submit(() -> {
                try {
                    recognizer.startContinuousRecognitionAsync().get();
                    isListening = true;
                    
                    // Send success event to JavaScript
                    WritableMap params = Arguments.createMap();
                    params.putBoolean("success", true);
                    reactContext.runOnUiQueueThread(() -> {
                        sendEvent("SpeechRecognitionStarted", params);
                    });
                    
                } catch (Exception e) {
                    Log.e(TAG, "Error starting continuous recognition", e);
                    WritableMap params = Arguments.createMap();
                    params.putBoolean("success", false);
                    params.putString("error", e.getMessage());
                    reactContext.runOnUiQueueThread(() -> {
                        sendEvent("SpeechRecognitionError", params);
                    });
                }
            });
            
            promise.resolve("Starting continuous recognition");
        } catch (Exception e) {
            Log.e(TAG, "Error starting continuous recognition", e);
            promise.reject("START_ERROR", "Error starting recognition: " + e.getMessage());
        }
    }

    @ReactMethod
    public void stopContinuousRecognition(Promise promise) {
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
                    microphoneStream.stopRecording();
                    isListening = false;
                    
                    // Send success event to JavaScript
                    WritableMap params = Arguments.createMap();
                    params.putBoolean("success", true);
                    reactContext.runOnUiQueueThread(() -> {
                        sendEvent("SpeechRecognitionStopped", params);
                    });
                    
                } catch (Exception e) {
                    Log.e(TAG, "Error stopping continuous recognition", e);
                    WritableMap params = Arguments.createMap();
                    params.putBoolean("success", false);
                    params.putString("error", e.getMessage());
                    reactContext.runOnUiQueueThread(() -> {
                        sendEvent("SpeechRecognitionError", params);
                    });
                }
            });
            
            promise.resolve("Stopping continuous recognition");
        } catch (Exception e) {
            Log.e(TAG, "Error stopping continuous recognition", e);
            promise.reject("STOP_ERROR", "Error stopping recognition: " + e.getMessage());
        }
    }

    @ReactMethod
    public void destroyRecognizer(Promise promise) {
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
                    microphoneStream.stopRecording();
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
