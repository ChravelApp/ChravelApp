
/**
 * Single source of truth for all audio parameters used in Gemini Live voice.
 * Input = microphone capture sent to server.
 * Output = server audio played back to user.
 */

// ── Input (mic → server) ───────────────────────────────────────────
export const INPUT_SAMPLE_RATE = 16_000;
export const INPUT_CHANNELS = 1;
export const INPUT_BITS_PER_SAMPLE = 16;
export const INPUT_MIME = 'audio/pcm;rate=16000';

// ── Output (server → speaker) ──────────────────────────────────────
export const OUTPUT_SAMPLE_RATE = 24_000;
export const OUTPUT_CHANNELS = 1;
export const OUTPUT_BITS_PER_SAMPLE = 16;
export const OUTPUT_MIME = 'audio/pcm;rate=24000';

// ── Derived ────────────────────────────────────────────────────────
/** Bytes per sample for PCM16 */
export const BYTES_PER_SAMPLE = INPUT_BITS_PER_SAMPLE / 8; // 2

/** Duration of one input chunk in ms (20ms is standard for real-time audio) */
export const INPUT_CHUNK_DURATION_MS = 20;

/** Number of samples per input chunk */
export const INPUT_CHUNK_SAMPLES = (INPUT_SAMPLE_RATE * INPUT_CHUNK_DURATION_MS) / 1000; // 320

/** Byte length of one input chunk */
export const INPUT_CHUNK_BYTES = INPUT_CHUNK_SAMPLES * BYTES_PER_SAMPLE; // 640

// ── Validation helpers ─────────────────────────────────────────────

/** Assert that a PCM16 buffer has valid length (must be even) */
export function assertValidPcm16(buffer: ArrayBuffer, label: string): void {
  if (buffer.byteLength % 2 !== 0) {
    throw new Error(`${label}: PCM16 buffer must have even byte length, got ${buffer.byteLength}`);
  }
}

/** Convert Float32 samples to Int16 PCM */
export function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

/** Convert Int16 PCM to Float32 samples */
export function int16ToFloat32(int16: Int16Array): Float32Array {
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff);
  }
  return float32;
}

/** Calculate RMS (root mean square) of Float32 audio samples */
export function calculateRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}
