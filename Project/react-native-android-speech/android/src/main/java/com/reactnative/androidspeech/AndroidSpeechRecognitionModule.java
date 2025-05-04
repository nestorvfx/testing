package com.reactnative.androidspeech;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

@ReactModule(name = AndroidSpeechRecognitionModule.NAME)
public class AndroidSpeechRecognitionModule extends ReactContextBaseJavaModule implements LifecycleEventListener {
    public static final String NAME = "AndroidSpeechRecognition";
    private SpeechRecognizer speechRecognizer;
    private final ReactApplicationContext reactContext;
    private boolean isRecognizing = false;
    private static final String TAG = "AndroidSpeech";
    
    // Event names - use constants to avoid typos
    private static final String EVENT_SPEECH_START = "onSpeechStart";
    private static final String EVENT_SPEECH_END = "onSpeechEnd";
    private static final String EVENT_SPEECH_RESULTS = "onSpeechResults";
    private static final String EVENT_SPEECH_ERROR = "onSpeechError";
    private static final String EVENT_SPEECH_PARTIAL_RESULTS = "onSpeechPartialResults";

    public AndroidSpeechRecognitionModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        reactContext.addLifecycleEventListener(this);
        Log.d(TAG, "AndroidSpeechRecognitionModule initialized");
    }

    @NonNull
    @Override
    public String getName() {
        return NAME;
    }

    @Override
    public Map<String, Object> getConstants() {
        // Add constants to help with debugging
        final Map<String, Object> constants = new HashMap<>();
        constants.put("isAvailable", SpeechRecognizer.isRecognitionAvailable(reactContext));
        constants.put("ERROR_NETWORK", SpeechRecognizer.ERROR_NETWORK);
        constants.put("ERROR_NETWORK_TIMEOUT", SpeechRecognizer.ERROR_NETWORK_TIMEOUT);
        constants.put("ERROR_NO_MATCH", SpeechRecognizer.ERROR_NO_MATCH);
        constants.put("ERROR_SPEECH_TIMEOUT", SpeechRecognizer.ERROR_SPEECH_TIMEOUT);
        constants.put("ERROR_CLIENT", SpeechRecognizer.ERROR_CLIENT);
        constants.put("ERROR_INSUFFICIENT_PERMISSIONS", SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS);
        constants.put("ERROR_SERVER", SpeechRecognizer.ERROR_SERVER);
        constants.put("ERROR_AUDIO", SpeechRecognizer.ERROR_AUDIO);
        
        return constants;
    }

    // Required for React Native event emitter
    @ReactMethod
    public void addListener(String eventName) {
        Log.d(TAG, "addListener: " + eventName);
    }

    @ReactMethod
    public void removeListeners(Integer count) {
        Log.d(TAG, "removeListeners: " + count);
    }

    private boolean checkPermission() {
        return ContextCompat.checkSelfPermission(reactContext, 
                Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }

    @ReactMethod
    public void startRecognizing(String languageLocale, final Promise promise) {
        Log.d(TAG, "startRecognizing called with language: " + languageLocale);
        
        if (!SpeechRecognizer.isRecognitionAvailable(reactContext)) {
            promise.reject("SPEECH_NOT_AVAILABLE", "Speech recognition not available on this device");
            return;
        }

        if (!checkPermission()) {
            promise.reject("PERMISSION_DENIED", "RECORD_AUDIO permission required");
            return;
        }

        if (isRecognizing) {
            promise.reject("ALREADY_RECOGNIZING", "Speech recognition already in progress");
            return;
        }

        // Get locale from language string (e.g., "en-US")
        final Locale locale;
        if (languageLocale != null && !languageLocale.isEmpty()) {
            String[] parts = languageLocale.split("-");
            if (parts.length > 1) {
                locale = new Locale(parts[0], parts[1]);
            } else {
                locale = new Locale(parts[0]);
            }
        } else {
            locale = Locale.getDefault();
        }

        // Ensure we run on the UI thread
        UiThreadUtil.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    if (speechRecognizer == null) {
                        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(reactContext);
                        Log.d(TAG, "Created new SpeechRecognizer on UI thread");
                    }

                    speechRecognizer.setRecognitionListener(createRecognitionListener());
                    
                    final Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, 
                            RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale);
                    intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
                    intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                    
                    speechRecognizer.startListening(intent);
                    isRecognizing = true;
                    Log.d(TAG, "Speech recognition started on UI thread");
                    promise.resolve(null);
                } catch (Exception e) {
                    Log.e(TAG, "Error starting speech recognition: " + e.getMessage(), e);
                    isRecognizing = false;
                    promise.reject("SPEECH_ERROR", e.getMessage());
                }
            }
        });
    }

    @ReactMethod
    public void stopRecognizing(final Promise promise) {
        Log.d(TAG, "stopRecognizing called");
        
        if (speechRecognizer == null || !isRecognizing) {
            promise.resolve(null);
            return;
        }

        // Ensure we run on the UI thread
        UiThreadUtil.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    speechRecognizer.stopListening();
                    Log.d(TAG, "Speech recognition stopped on UI thread");
                    promise.resolve(null);
                } catch (Exception e) {
                    Log.e(TAG, "Error stopping speech recognition: " + e.getMessage(), e);
                    promise.reject("SPEECH_ERROR", e.getMessage());
                }
            }
        });
    }

    @ReactMethod
    public void isRecognizing(final Promise promise) {
        promise.resolve(isRecognizing);
    }

    @ReactMethod
    public void isSpeechAvailable(final Promise promise) {
        promise.resolve(SpeechRecognizer.isRecognitionAvailable(reactContext));
    }

    private RecognitionListener createRecognitionListener() {
        return new RecognitionListener() {
            @Override
            public void onReadyForSpeech(Bundle params) {
                Log.d(TAG, "onReadyForSpeech");
                sendEvent(EVENT_SPEECH_START, null);
            }

            @Override
            public void onBeginningOfSpeech() {
                Log.d(TAG, "onBeginningOfSpeech");
                sendEvent(EVENT_SPEECH_START, null);
            }

            @Override
            public void onRmsChanged(float rmsdB) {
                // Optional: send volume level
            }

            @Override
            public void onBufferReceived(byte[] buffer) {
                // Not used for simple speech recognition
            }

            @Override
            public void onEndOfSpeech() {
                Log.d(TAG, "onEndOfSpeech");
                sendEvent(EVENT_SPEECH_END, null);
            }

            @Override
            public void onError(int error) {
                isRecognizing = false;
                String errorMessage = getErrorMessage(error);
                Log.e(TAG, "Speech recognition error: " + errorMessage + " (code: " + error + ")");
                
                WritableMap params = Arguments.createMap();
                params.putString("error", errorMessage);
                params.putInt("code", error);
                sendEvent(EVENT_SPEECH_ERROR, params);
            }

            @Override
            public void onResults(Bundle results) {
                isRecognizing = false;
                ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                WritableMap params = Arguments.createMap();
                
                if (matches != null && !matches.isEmpty()) {
                    String recognizedText = matches.get(0);
                    Log.d(TAG, "Speech recognition result: " + recognizedText);
                    params.putString("value", recognizedText);
                } else {
                    params.putString("value", "");
                    Log.d(TAG, "Speech recognition result: empty");
                }
                
                sendEvent(EVENT_SPEECH_RESULTS, params);
            }

            @Override
            public void onPartialResults(Bundle partialResults) {
                ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches != null && !matches.isEmpty()) {
                    WritableMap params = Arguments.createMap();
                    params.putString("value", matches.get(0));
                    sendEvent(EVENT_SPEECH_PARTIAL_RESULTS, params);
                }
            }

            @Override
            public void onEvent(int eventType, Bundle params) {
                // Not used
            }
        };
    }

    private String getErrorMessage(int errorCode) {
        String message;
        switch (errorCode) {
            case SpeechRecognizer.ERROR_AUDIO:
                message = "Audio recording error";
                break;
            case SpeechRecognizer.ERROR_CLIENT:
                message = "Client side error";
                break;
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                message = "Insufficient permissions";
                break;
            case SpeechRecognizer.ERROR_NETWORK:
                message = "Network error";
                break;
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                message = "Network timeout";
                break;
            case SpeechRecognizer.ERROR_NO_MATCH:
                message = "No recognition matches";
                break;
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                message = "Speech recognition service is busy";
                break;
            case SpeechRecognizer.ERROR_SERVER:
                message = "Server error";
                break;
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                message = "No speech input";
                break;
            default:
                message = "Unknown error (" + errorCode + ")";
                break;
        }
        return message;
    }

    private void sendEvent(String eventName, @Nullable WritableMap params) {
        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
    }

    @Override
    public void onHostResume() {
        // App is resumed
    }

    @Override
    public void onHostPause() {
        // App is paused
    }

    @Override
    public void onHostDestroy() {
        Log.d(TAG, "onHostDestroy - cleaning up");
        
        UiThreadUtil.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (speechRecognizer != null) {
                    try {
                        if (isRecognizing) {
                            speechRecognizer.stopListening();
                            isRecognizing = false;
                        }
                        speechRecognizer.destroy();
                        speechRecognizer = null;
                        Log.d(TAG, "SpeechRecognizer destroyed on UI thread");
                    } catch (Exception e) {
                        Log.e(TAG, "Error destroying speech recognizer: " + e.getMessage(), e);
                    }
                }
            }
        });
    }
}
