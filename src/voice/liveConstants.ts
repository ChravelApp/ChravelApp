
import { INPUT_SAMPLE_RATE, BYTES_PER_SAMPLE } from './audioContract';

// ── MIME types for Gemini Live protocol ────────────────────────────
export const LIVE_INPUT_MIME = 'audio/pcm;rate=16000';
export const LIVE_OUTPUT_MIME = 'audio/pcm;rate=24000';

// ── WebSocket timing ───────────────────────────────────────────────
/** Send a silent keepalive frame this often to prevent server timeout */
export const WS_KEEPALIVE_INTERVAL_MS = 15_000;

/** Max time to wait for setupComplete after opening WS */
export const WS_SETUP_TIMEOUT_MS = 20_000;

/** Max automatic reconnect retries before giving up */
export const MAX_AUTO_RECONNECT_RETRIES = 2;

/** Base delay for exponential backoff on reconnect (ms) */
export const RECONNECT_BASE_DELAY_MS = 1_000;

// ── Voice Activity Detection thresholds ────────────────────────────
/** RMS threshold above which we consider the user to be barging in during AI playback */
export const BARGE_IN_RMS_THRESHOLD = 0.035;

// ── Silent keepalive frame ─────────────────────────────────────────
/**
 * Generate a silent PCM16 frame (~133ms at 16kHz) encoded as base64.
 * Sent periodically to keep the WebSocket alive.
 */
function generateSilentKeepaliveFrame(): string {
  const durationMs = 133;
  const numSamples = Math.ceil((INPUT_SAMPLE_RATE * durationMs) / 1000);
  const buffer = new ArrayBuffer(numSamples * BYTES_PER_SAMPLE);
  // Buffer is already zeroed (silence)
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const SILENT_KEEPALIVE_FRAME = generateSilentKeepaliveFrame();

// ── Error code mapping ─────────────────────────────────────────────
const ERROR_MESSAGES: Record<number, string> = {
  1000: 'Session ended normally',
  1001: 'Server going away',
  1006: 'Connection lost unexpectedly',
  1008: 'Policy violation',
  1011: 'Server error',
  1013: 'Server overloaded, try again later',
  4000: 'Authentication failed',
  4001: 'Session expired',
  4002: 'Rate limit exceeded',
  4003: 'Invalid request',
};

export function getErrorMessage(code: number): string {
  return ERROR_MESSAGES[code] || `Connection error (code: ${code})`;
}

/** Whether a close code indicates we should attempt reconnection */
export function isRetryableClose(code: number): boolean {
  return code === 1001 || code === 1006 || code === 1011 || code === 1013;
}
