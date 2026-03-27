
import { INPUT_SAMPLE_RATE, float32ToInt16, calculateRms } from './audioContract';

type AudioDataCallback = (base64Pcm: string, rms: number) => void;

/**
 * Captures microphone audio, resamples to 16kHz mono PCM16, and
 * delivers base64-encoded chunks via callback.
 *
 * Uses AudioWorklet when available (modern browsers), falls back
 * to ScriptProcessorNode for older iOS WebView.
 */
export class AudioCapture {
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private callback: AudioDataCallback | null = null;
  private running = false;

  /** Request mic and start capturing audio */
  async start(callback: AudioDataCallback): Promise<void> {
    if (this.running) return;

    this.callback = callback;

    // Request microphone
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: { ideal: INPUT_SAMPLE_RATE },
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.audioContext = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });

    // iOS requires resume after user gesture
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);

    const workletSupported = typeof AudioWorkletNode !== 'undefined';

    if (workletSupported) {
      await this.setupWorklet();
    } else {
      this.setupScriptProcessor();
    }

    this.running = true;
  }

  /** Stop capturing and release all resources */
  stop(): void {
    this.running = false;

    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.scriptNode) {
      this.scriptNode.disconnect();
      this.scriptNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    this.callback = null;
  }

  get isRunning(): boolean {
    return this.running;
  }

  // ── AudioWorklet path ──────────────────────────────────────────

  private async setupWorklet(): Promise<void> {
    if (!this.audioContext || !this.sourceNode) return;

    // Inline the worklet processor as a blob URL
    const processorCode = `
      class PcmCaptureProcessor extends AudioWorkletProcessor {
        process(inputs) {
          const input = inputs[0];
          if (input && input[0] && input[0].length > 0) {
            this.port.postMessage(input[0]);
          }
          return true;
        }
      }
      registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
    `;

    const blob = new Blob([processorCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);

    try {
      await this.audioContext.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }

    this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-capture-processor');
    this.workletNode.port.onmessage = (event: MessageEvent) => {
      if (!this.running || !this.callback) return;
      const float32: Float32Array = event.data;
      this.deliverChunk(float32);
    };

    this.sourceNode.connect(this.workletNode);
    this.workletNode.connect(this.audioContext.destination);
  }

  // ── ScriptProcessorNode fallback ───────────────────────────────

  private setupScriptProcessor(): void {
    if (!this.audioContext || !this.sourceNode) return;

    const bufferSize = 4096;
    this.scriptNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

    this.scriptNode.onaudioprocess = (event: AudioProcessingEvent) => {
      if (!this.running || !this.callback) return;
      const float32 = event.inputBuffer.getChannelData(0);
      this.deliverChunk(new Float32Array(float32));
    };

    this.sourceNode.connect(this.scriptNode);
    this.scriptNode.connect(this.audioContext.destination);
  }

  // ── Shared processing ──────────────────────────────────────────

  private deliverChunk(float32: Float32Array): void {
    if (!this.callback) return;

    const rms = calculateRms(float32);

    // Resample if AudioContext sample rate differs from target
    const resampled =
      this.audioContext && this.audioContext.sampleRate !== INPUT_SAMPLE_RATE
        ? this.resample(float32, this.audioContext.sampleRate, INPUT_SAMPLE_RATE)
        : float32;

    const int16 = float32ToInt16(resampled);
    const base64 = this.int16ToBase64(int16);

    this.callback(base64, rms);
  }

  private resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
    const ratio = fromRate / toRate;
    const outputLength = Math.round(input.length / ratio);
    const output = new Float32Array(outputLength);
    for (let i = 0; i < outputLength; i++) {
      const srcIdx = i * ratio;
      const lo = Math.floor(srcIdx);
      const hi = Math.min(lo + 1, input.length - 1);
      const frac = srcIdx - lo;
      output[i] = input[lo] * (1 - frac) + input[hi] * frac;
    }
    return output;
  }

  private int16ToBase64(int16: Int16Array): string {
    const bytes = new Uint8Array(int16.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
