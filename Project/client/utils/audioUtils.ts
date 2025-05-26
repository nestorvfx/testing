/**
 * Convert Float32Array to Int16Array (16-bit PCM)
 * OCI Speech service expects 16-bit PCM audio data
 */
export function convertFloat32ToInt16(buffer: Float32Array): Int16Array {
  const length = buffer.length;
  const result = new Int16Array(length);
  
  for (let i = 0; i < length; i++) {
    // Clamp values to [-1, 1] and convert to 16-bit integer
    const clampedValue = Math.min(1, Math.max(-1, buffer[i]));
    result[i] = clampedValue * 0x7FFF;
  }
  
  return result;
}

/**
 * Create audio context with specific sample rate for OCI Speech
 */
export function createAudioContext(): AudioContext {
  return new (window.AudioContext || (window as any).webkitAudioContext)({
    sampleRate: 16000 // OCI Speech requires 16kHz sample rate
  });
}

/**
 * Request microphone access
 */
export async function requestMicrophoneAccess(): Promise<MediaStream> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Microphone access not supported in this browser");
  }
  
  return await navigator.mediaDevices.getUserMedia({
    audio: {
      sampleRate: 16000,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true
    }
  });
}
