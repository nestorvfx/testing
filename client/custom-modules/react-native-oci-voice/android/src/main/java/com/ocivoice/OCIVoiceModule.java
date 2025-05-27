package com.ocivoice;

import android.Manifest;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.ShortBuffer;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

public class OCIVoiceModule extends ReactContextBaseJavaModule {
    private static final String TAG = "OCIVoiceModule";
    private static final String MODULE_NAME = "OCIVoice";
    
    // Audio configuration
    private static final int SAMPLE_RATE = 16000;
    private static final int CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO;
    private static final int AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT;
    private static final int BUFFER_SIZE = AudioRecord.getMinBufferSize(
            SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT) * 2;
    
    // Module state
    private boolean isInitialized = false;
    private boolean isListening = false;
    private String sessionToken = null;
    private String compartmentId = null;
    private String region = "eu-amsterdam-1"; // Default region
      // Audio recording components
    private AudioRecord audioRecord = null;
    private ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile boolean shouldContinue = false;
    private volatile boolean isRecording = false;
    private final Object audioLock = new Object();
    
    // WebSocket components
    private OkHttpClient okHttpClient = new OkHttpClient();
    private WebSocket webSocket = null;
    
    // Main thread handler for event dispatch
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
      public OCIVoiceModule(ReactApplicationContext reactContext) {
        super(reactContext);
        
        // Configure OkHttpClient with appropriate timeouts for WebSocket connections
        okHttpClient = new OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(0, TimeUnit.SECONDS)  // No read timeout for WebSocket
                .writeTimeout(30, TimeUnit.SECONDS)
                .build();
    }
    
    @NonNull
    @Override
    public String getName() {
        return MODULE_NAME;
    }
    
    /**
     * Initialize the module with configuration
     * @param config Configuration options
     * @param promise Promise to resolve with result
     */
    @ReactMethod
    public void initialize(ReadableMap config, Promise promise) {
        if (isInitialized) {
            promise.resolve(true);
            return;
        }
        
        try {
            // Extract configuration values
            if (config.hasKey("region")) {
                region = config.getString("region");
            }
            
            // Check for microphone permission
            if (ActivityCompat.checkSelfPermission(getReactApplicationContext(),
                    Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                promise.reject("PERMISSION_DENIED", "Microphone permission not granted");
                return;
            }
            
            isInitialized = true;
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Error initializing module", e);
            promise.reject("INIT_ERROR", "Failed to initialize: " + e.getMessage());
        }
    }
    
    /**
     * Start listening for speech
     * @param options Options for speech recognition
     * @param promise Promise to resolve with result
     */
    @ReactMethod
    public void startListening(ReadableMap options, Promise promise) {
        if (!isInitialized) {
            promise.reject("NOT_INITIALIZED", "Module not initialized");
            return;
        }
        
        if (isListening) {
            promise.resolve(true); // Already listening
            return;
        }
        
        try {
            // Extract options
            if (options.hasKey("token")) {
                sessionToken = options.getString("token");
            }
            
            if (options.hasKey("compartmentId")) {
                compartmentId = options.getString("compartmentId");
            }
            
            if (sessionToken == null || compartmentId == null) {
                promise.reject("MISSING_CREDENTIALS", "Session token and compartment ID are required");
                return;
            }
              // Connect to WebSocket first
            connectWebSocket();
            
            // Note: Audio recording will start after successful authentication (CONNECT event)
            
            isListening = true;
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Error starting listening", e);
            promise.reject("START_ERROR", "Failed to start listening: " + e.getMessage());
        }
    }
    
    /**
     * Stop listening for speech
     * @param promise Promise to resolve with result
     */
    @ReactMethod
    public void stopListening(Promise promise) {
        if (!isListening) {
            promise.resolve(true); // Already stopped
            return;
        }
        
        try {
            stopAudioCapture();
            closeWebSocket();
            
            isListening = false;
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Error stopping listening", e);
            promise.reject("STOP_ERROR", "Failed to stop listening: " + e.getMessage());
        }
    }
      /**
     * Clean up resources
     */
    @ReactMethod
    public void destroy() {
        Log.d(TAG, "Destroying OCIVoiceModule...");
        
        if (isListening) {
            stopAudioCapture();
            closeWebSocket();
        }
        
        isInitialized = false;
        isListening = false;
        
        // Shut down executor and wait for completion
        if (executor != null && !executor.isShutdown()) {
            executor.shutdown();
            try {
                if (!executor.awaitTermination(2, TimeUnit.SECONDS)) {
                    Log.w(TAG, "Executor did not terminate gracefully, forcing shutdown");
                    executor.shutdownNow();
                }
            } catch (InterruptedException e) {
                Log.w(TAG, "Interrupted while waiting for executor termination");
                executor.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }
        
        Log.d(TAG, "OCIVoiceModule destroyed successfully");
    }
      /**
     * Connect to OCI Speech WebSocket
     */
    private void connectWebSocket() {
        // Build WebSocket URL
        String baseUrl = "wss://realtime.aiservice." + region + ".oci.oraclecloud.com/ws/transcribe/stream";
        String url = baseUrl + "?isAckEnabled=false" +
                "&partialSilenceThresholdInMs=0" +
                "&finalSilenceThresholdInMs=1000" +
                "&stabilizePartialResults=NONE" +
                "&shouldIgnoreInvalidCustomizations=false" +
                "&languageCode=en-US" +
                "&modelDomain=GENERIC" +
                "&punctuation=NONE" +
                "&encoding=audio%2Fraw%3Brate%3D16000";
        
        Log.d(TAG, "Region: " + region);
        Log.d(TAG, "Session Token: " + (sessionToken != null ? "Present (length: " + sessionToken.length() + ")" : "NULL"));
        Log.d(TAG, "Compartment ID: " + compartmentId);
        Log.d(TAG, "Connecting to WebSocket: " + url);
        
        // Create request
        Request request = new Request.Builder()
                .url(url)
                .build();
        
        // Create WebSocket listener
        WebSocketListener listener = new WebSocketListener() {            @Override            public void onOpen(WebSocket webSocket, Response response) {
                Log.d(TAG, "WebSocket connected successfully");
                Log.d(TAG, "Response code: " + response.code());
                Log.d(TAG, "Response message: " + response.message());
                
                // Small delay to ensure connection is fully established
                mainHandler.postDelayed(() -> {
                    Log.d(TAG, "Sending authentication message...");
                    
                    // Send authentication message
                    try {
                        JSONObject authMessage = new JSONObject();
                        authMessage.put("authenticationType", "TOKEN");
                        authMessage.put("token", sessionToken);
                        authMessage.put("compartmentId", compartmentId);
                        
                        String authMessageStr = authMessage.toString();
                        Log.d(TAG, "Auth message: " + authMessageStr);
                        webSocket.send(authMessageStr);
                    } catch (JSONException e) {
                        Log.e(TAG, "Error creating authentication message", e);
                        emitSpeechError("auth_error", "Failed to create authentication message");
                    }
                }, 100); // 100ms delay
            }
              @Override
            public void onMessage(WebSocket webSocket, String text) {
                Log.d(TAG, "Received WebSocket message: " + text);
                
                try {
                    JSONObject message = new JSONObject(text);
                    
                    // Check for CONNECT event (authentication successful)
                    if (message.has("event") && "CONNECT".equals(message.getString("event"))) {
                        Log.d(TAG, "OCI Speech authentication successful - CONNECT event received");
                        emitSpeechStart();
                        return;
                    }
                    
                    // Check for ERROR event
                    if (message.has("event") && "ERROR".equals(message.getString("event"))) {
                        String errorMsg = message.optString("message", "Unknown error");
                        int errorCode = message.optInt("code", -1);
                        Log.e(TAG, "OCI Speech error - Code: " + errorCode + ", Message: " + errorMsg);
                        emitSpeechError("service_error", "OCI Speech error: " + errorMsg);
                        return;
                    }
                    
                    // Handle transcription results
                    if (message.has("event") && "RESULT".equals(message.getString("event"))) {
                        handleTranscriptionResult(message);
                    }
                } catch (JSONException e) {
                    Log.e(TAG, "Error parsing WebSocket message", e);
                }
            }
            
            @Override
            public void onClosed(WebSocket webSocket, int code, String reason) {
                Log.d(TAG, "WebSocket closed: " + code + " " + reason);
                emitSpeechEnd();
            }            @Override
            public void onFailure(WebSocket webSocket, Throwable t, Response response) {
                String message = t.getMessage();
                String responseMessage = response != null ? response.message() : "Unknown error";
                int responseCode = response != null ? response.code() : -1;
                
                Log.e(TAG, "WebSocket error details:", t);
                Log.e(TAG, "Error message: " + message);
                Log.e(TAG, "Response code: " + responseCode);
                Log.e(TAG, "Response message: " + responseMessage);
                Log.e(TAG, "Error type: " + t.getClass().getSimpleName());
                
                if (response != null && response.body() != null) {
                    try {
                        String responseBody = response.body().string();
                        Log.e(TAG, "Response body: " + responseBody);
                    } catch (Exception e) {
                        Log.e(TAG, "Could not read response body", e);
                    }
                }
                
                // Check if this is a "Broken pipe" error which can happen immediately after sending auth
                if (message != null && message.contains("Broken pipe")) {
                    Log.w(TAG, "Broken pipe error - this might be a timing issue or authentication problem");
                }
                
                emitSpeechError("connection_error", 
                        "WebSocket error: " + message + ", Response: " + responseMessage + " (Code: " + responseCode + ")");
            }
        };
        
        // Connect WebSocket
        webSocket = okHttpClient.newWebSocket(request, listener);
    }
    
    /**
     * Close WebSocket connection
     */
    private void closeWebSocket() {
        if (webSocket != null) {
            webSocket.close(1000, "Normal closure");
            webSocket = null;
        }
    }
      /**
     * Start audio capture
     */
    private void startAudioCapture() {
        if (ActivityCompat.checkSelfPermission(getReactApplicationContext(),
                Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            emitSpeechError("permission_error", "Microphone permission not granted");
            return;
        }
        
        synchronized (audioLock) {
            // Don't start if already recording
            if (isRecording) {
                Log.d(TAG, "Audio capture already running");
                return;
            }
            
            try {
                audioRecord = new AudioRecord(
                        MediaRecorder.AudioSource.MIC,
                        SAMPLE_RATE,
                        CHANNEL_CONFIG,
                        AUDIO_FORMAT,
                        BUFFER_SIZE);
                
                if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                    emitSpeechError("audio_init_error", "Failed to initialize AudioRecord");
                    return;
                }
                
                audioRecord.startRecording();
                shouldContinue = true;
                isRecording = true;
                Log.d(TAG, "AudioRecord started successfully");                // Start audio processing in a background thread
                executor.execute(() -> {
                    short[] buffer = new short[BUFFER_SIZE / 2];
                    
                    while (shouldContinue && webSocket != null) {
                        // Check if we should continue before each read operation
                        if (!shouldContinue) {
                            Log.d(TAG, "shouldContinue is false, breaking audio loop");
                            break;
                        }
                        
                        synchronized (audioLock) {
                            if (audioRecord == null || !isRecording) {
                                Log.d(TAG, "AudioRecord is null or not recording, breaking audio loop");
                                break;
                            }
                        }
                        
                        int readResult;
                        try {
                            readResult = audioRecord.read(buffer, 0, buffer.length);
                        } catch (IllegalStateException e) {
                            Log.w(TAG, "AudioRecord read failed - likely stopped: " + e.getMessage());
                            break;
                        }
                        
                        if (readResult > 0 && shouldContinue) {
                            // Calculate audio volume
                            float volume = calculateVolume(buffer, readResult);
                            emitVolumeChanged(volume);
                            
                            // Send audio data over WebSocket
                            if (webSocket != null && shouldContinue) {
                                try {
                                    ByteBuffer byteBuffer = ByteBuffer.allocate(readResult * 2);
                                    byteBuffer.order(ByteOrder.LITTLE_ENDIAN);
                                    
                                    byteBuffer.asShortBuffer().put(buffer, 0, readResult);
                                    webSocket.send(ByteString.of(byteBuffer.array(), 0, readResult * 2));
                                } catch (Exception e) {
                                    Log.w(TAG, "Failed to send audio data over WebSocket: " + e.getMessage());
                                    break;
                                }
                            }
                        } else if (readResult < 0) {
                            Log.w(TAG, "AudioRecord read returned error: " + readResult);
                            break;
                        }
                    }
                    
                    Log.d(TAG, "Audio capture loop ended - AudioRecord cleanup will be handled by stopAudioCapture()");
                });
            } catch (Exception e) {
                Log.e(TAG, "Error starting audio capture", e);
                emitSpeechError("audio_capture_error", "Failed to start audio capture: " + e.getMessage());
                isRecording = false;
            }
        }
    }    /**
     * Stop audio capture
     */
    private void stopAudioCapture() {
        Log.d(TAG, "stopAudioCapture called - setting shouldContinue to false");
        shouldContinue = false;
        
        // Wait a moment for the background thread to finish its current iteration
        try {
            Thread.sleep(50);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        synchronized (audioLock) {
            if (audioRecord != null && isRecording) {
                try {
                    Log.d(TAG, "AudioRecord state: " + audioRecord.getState() + ", isRecording: " + isRecording);
                    
                    if (audioRecord.getState() == AudioRecord.STATE_INITIALIZED && 
                        audioRecord.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) {
                        Log.d(TAG, "Stopping AudioRecord...");
                        audioRecord.stop();
                        Log.d(TAG, "AudioRecord stopped successfully");
                    } else {
                        Log.d(TAG, "AudioRecord was not in recording state, skipping stop()");
                    }
                    
                    isRecording = false;
                    audioRecord.release();
                    Log.d(TAG, "AudioRecord released");
                    
                } catch (IllegalStateException e) {
                    Log.w(TAG, "AudioRecord IllegalStateException during stop: " + e.getMessage());
                    isRecording = false;
                } catch (Exception e) {
                    Log.e(TAG, "Error stopping AudioRecord: " + e.getMessage());
                    isRecording = false;
                } finally {
                    audioRecord = null;
                    isRecording = false;
                }
            } else {
                Log.d(TAG, "AudioRecord is null or not recording - no cleanup needed");
            }
        }
    }
    
    /**
     * Calculate audio volume
     * @param buffer Audio buffer
     * @param size Buffer size
     * @return Volume level (0.0 - 1.0)
     */
    private float calculateVolume(short[] buffer, int size) {
        long sum = 0;
        for (int i = 0; i < size; i++) {
            sum += buffer[i] * buffer[i];
        }
        
        double rms = Math.sqrt(sum / size);
        float volume = (float) (rms / 32767.0); // Normalize to 0.0 - 1.0
        
        return Math.min(1.0f, volume);
    }
    
    /**
     * Handle transcription results from OCI Speech
     * @param message JSON message from WebSocket
     */
    private void handleTranscriptionResult(JSONObject message) {
        try {
            if (!message.has("transcriptions")) {
                return;
            }
            
            JSONObject transcription = message.getJSONArray("transcriptions").getJSONObject(0);
            String text = transcription.getString("transcription");
            boolean isFinal = transcription.getBoolean("isFinal");
              WritableMap result = Arguments.createMap();
            WritableArray value = Arguments.createArray();
            value.pushString(text);
            result.putArray("value", value);
            result.putBoolean("isFinal", isFinal);
            
            if (isFinal) {
                Log.d(TAG, "Final transcription result: " + text);
                emitSpeechResults(result);
            } else {
                Log.d(TAG, "Partial transcription result: " + text);
                emitSpeechPartialResults(result);
            }
        } catch (JSONException e) {
            Log.e(TAG, "Error handling transcription result", e);
        }
    }
      /**
     * Emit speech start event and start audio capture
     */
    private void emitSpeechStart() {
        // Start audio capture now that authentication is successful
        startAudioCapture();
        
        mainHandler.post(() -> {
            getReactApplicationContext()
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("onSpeechStart", null);
        });
    }
    
    /**
     * Emit speech end event
     */
    private void emitSpeechEnd() {
        mainHandler.post(() -> {
            getReactApplicationContext()
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("onSpeechEnd", null);
        });
    }
    
    /**
     * Emit speech results event
     * @param results Speech results
     */
    private void emitSpeechResults(WritableMap results) {
        mainHandler.post(() -> {
            getReactApplicationContext()
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("onSpeechResults", results);
        });
    }
    
    /**
     * Emit speech partial results event
     * @param results Partial speech results
     */
    private void emitSpeechPartialResults(WritableMap results) {
        mainHandler.post(() -> {
            getReactApplicationContext()
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("onSpeechPartialResults", results);
        });
    }
    
    /**
     * Emit speech error event
     * @param error Error code
     * @param message Error message
     */
    private void emitSpeechError(String error, String message) {
        WritableMap errorMap = Arguments.createMap();
        errorMap.putString("error", error);
        errorMap.putString("message", message);
        
        mainHandler.post(() -> {
            getReactApplicationContext()
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("onSpeechError", errorMap);
        });
    }
    
    /**
     * Emit volume changed event
     * @param volume Volume level (0.0 - 1.0)
     */    private void emitVolumeChanged(float volume) {
        WritableMap volumeMap = Arguments.createMap();
        volumeMap.putDouble("value", volume);
        
        mainHandler.post(() -> {
            ReactApplicationContext context = getReactApplicationContext();
            if (context != null && context.hasActiveCatalystInstance()) {
                context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                        .emit("onSpeechVolumeChanged", volumeMap);
            }
        });
    }
}
