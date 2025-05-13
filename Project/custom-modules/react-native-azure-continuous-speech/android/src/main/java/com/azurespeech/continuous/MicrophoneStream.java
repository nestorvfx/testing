package com.azurespeech.continuous;

import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.util.Log;

import com.microsoft.cognitiveservices.speech.audio.AudioStreamFormat;
import com.microsoft.cognitiveservices.speech.audio.PullAudioInputStreamCallback;

/**
 * MicrophoneStream exposes the Android Microphone as a PullAudioInputStreamCallback
 * to be consumed by the Azure Speech SDK.
 * It configures the microphone with 16 kHz sample rate, 16 bit samples, mono (single-channel).
 */
public class MicrophoneStream extends PullAudioInputStreamCallback {
    private final static String TAG = "MicrophoneStream";
    private final static int SAMPLE_RATE = 16000;
    private final AudioStreamFormat format;
    private AudioRecord recorder;
    private boolean isRecording = false;

    public MicrophoneStream() {
        this.format = AudioStreamFormat.getWaveFormatPCM(SAMPLE_RATE, (short)16, (short)1);
        this.initMic();
    }

    public AudioStreamFormat getFormat() {
        return this.format;
    }

    @Override
    public int read(byte[] bytes) {
        if (this.recorder != null && this.isRecording) {
            long ret = this.recorder.read(bytes, 0, bytes.length);
            return (int) ret;
        }
        return 0;
    }

    @Override
    public void close() {
        Log.d(TAG, "Closing microphone stream");
        stopRecording();
        if (this.recorder != null) {
            try {
                this.recorder.release();
            } catch (Exception e) {
                Log.e(TAG, "Error releasing recorder: " + e.getMessage());
            } finally {
                this.recorder = null;
            }
        }
    }

    public void startRecording() {
        if (this.recorder != null && !this.isRecording) {
            try {
                this.recorder.startRecording();
                this.isRecording = true;
                Log.d(TAG, "Started recording");
            } catch (Exception e) {
                Log.e(TAG, "Error starting recording: " + e.getMessage());
            }
        }
    }

    public void stopRecording() {
        if (this.recorder != null && this.isRecording) {
            try {
                this.recorder.stop();
                this.isRecording = false;
                Log.d(TAG, "Stopped recording");
            } catch (Exception e) {
                Log.e(TAG, "Error stopping recording: " + e.getMessage());
            }
        }
    }

    private void initMic() {
        Log.d(TAG, "Initializing microphone");
        try {
            // Note: Speech SDK currently supports 16 kHz sample rate, 16 bit samples, mono (single-channel) only
            AudioFormat af = new AudioFormat.Builder()
                    .setSampleRate(SAMPLE_RATE)
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
                    .build();
            
            this.recorder = new AudioRecord.Builder()
                    .setAudioSource(MediaRecorder.AudioSource.VOICE_RECOGNITION)
                    .setAudioFormat(af)
                    .build();
            
            // Don't automatically start recording - we'll do this explicitly
            Log.d(TAG, "Microphone initialized successfully");
        } catch (Exception e) {
            Log.e(TAG, "Error initializing microphone: " + e.getMessage());
            if (this.recorder != null) {
                this.recorder.release();
                this.recorder = null;
            }
        }
    }

    public static MicrophoneStream create() {
        return new MicrophoneStream();
    }
    
    public boolean isInitialized() {
        return this.recorder != null;
    }
}
