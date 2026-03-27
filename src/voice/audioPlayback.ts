
import { OUTPUT_SAMPLE_RATE, int16ToFloat32, calculateRms } from './audioContract';

/**
 * Queued audio playback for server-sent PCM16 audio at 24kHz.
 *
 * Schedules AudioBuffers on a shared AudioContext for gapless playback.
 * Supports flush (for barge-in) and RMS tracking (for waveform visualization).
 */
export class AudioPlayback {
  private audioContext: AudioContext | null = null;
  private scheduledSources: AudioBufferSourceNode[] = [];
  private nextStartTime = 0;
  private currentRms = 0;
  private playing = false;
  private firstFrameCallback: (() => void) | null = null;
  private firstFramePlayed = false;

  constructor() {
    this.audioContext = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
  }

  /** Set callback for when the first audio frame starts playing */
  onFirstFramePlayed(callback: () => void): void {
    this.firstFrameCallback = callback;
  }

  /** Enqueue a base64-encoded PCM16 chunk for playback */
  enqueue(base64Pcm: string): void {
    if (!this.audioContext) return;

    // Resume if suspended (iOS requirement)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const int16 = this.base64ToInt16(base64Pcm);
    const float32 = int16ToFloat32(int16);

    this.currentRms = calculateRms(float32);

    const buffer = this.audioContext.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
    buffer.getChannelData(0).set(float32);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    // Schedule gapless playback
    const now = this.audioContext.currentTime;
    const startAt = Math.max(now, this.nextStartTime);
    source.start(startAt);
    this.nextStartTime = startAt + buffer.duration;

    source.onended = () => {
      const idx = this.scheduledSources.indexOf(source);
      if (idx !== -1) this.scheduledSources.splice(idx, 1);
      if (this.scheduledSources.length === 0) {
        this.playing = false;
        this.currentRms = 0;
      }
    };

    this.scheduledSources.push(source);
    this.playing = true;

    if (!this.firstFramePlayed) {
      this.firstFramePlayed = true;
      this.firstFrameCallback?.();
    }
  }

  /** Flush all queued audio (for barge-in) */
  flush(): void {
    for (const source of this.scheduledSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Already stopped
      }
    }
    this.scheduledSources = [];
    this.nextStartTime = 0;
    this.playing = false;
    this.currentRms = 0;
  }

  /** Get current RMS level for waveform visualization */
  getRms(): number {
    return this.currentRms;
  }

  /** Whether audio is currently playing */
  isPlaying(): boolean {
    return this.playing;
  }

  /** Clean up AudioContext */
  destroy(): void {
    this.flush();
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }

  /** Reset first-frame tracking for a new session */
  resetFirstFrame(): void {
    this.firstFramePlayed = false;
  }

  private base64ToInt16(base64: string): Int16Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Int16Array(bytes.buffer);
  }
}
