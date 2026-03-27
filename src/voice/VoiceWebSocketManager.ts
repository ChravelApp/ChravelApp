
import {
  WS_KEEPALIVE_INTERVAL_MS,
  WS_SETUP_TIMEOUT_MS,
  MAX_AUTO_RECONNECT_RETRIES,
  RECONNECT_BASE_DELAY_MS,
  SILENT_KEEPALIVE_FRAME,
  LIVE_INPUT_MIME,
  getErrorMessage,
  isRetryableClose,
} from './liveConstants';
import { CircuitBreaker } from './circuitBreaker';

// ── Event types ────────────────────────────────────────────────────

export interface VoiceWSEvents {
  onSetupComplete: () => void;
  onAudioData: (base64Audio: string) => void;
  onTranscript: (text: string, isFinal: boolean) => void;
  /** User speech as text (Live API inputTranscription / serverContent.input_transcription) */
  onUserTranscript?: (text: string, isFinal: boolean) => void;
  onInterrupted: () => void;
  onError: (error: string) => void;
  onClose: (code: number, reason: string) => void;
}

interface SetupMessage {
  setup: {
    model: string;
    generation_config?: Record<string, unknown>;
    system_instruction?: { parts: { text: string }[] };
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object';
}

function readTranscriptionChunk(
  v: unknown
): { text: string; finished: boolean } | null {
  if (!isRecord(v)) return null;
  const text = v.text;
  if (typeof text !== 'string' || !text) return null;
  return { text, finished: Boolean(v.finished) };
}

// ── Manager ────────────────────────────────────────────────────────

export class VoiceWebSocketManager {
  private ws: WebSocket | null = null;
  private keepaliveInterval: ReturnType<typeof setInterval> | null = null;
  private setupTimeout: ReturnType<typeof setTimeout> | null = null;
  private setupComplete = false;
  private reconnectAttempts = 0;
  private events: VoiceWSEvents;
  private circuitBreaker: CircuitBreaker;
  private closed = false;

  // Stored for reconnection
  private lastUrl = '';
  private lastToken = '';
  private lastSetup: SetupMessage | null = null;

  constructor(events: VoiceWSEvents, circuitBreaker: CircuitBreaker) {
    this.events = events;
    this.circuitBreaker = circuitBreaker;
  }

  /** Open WebSocket, send setup message, wait for setupComplete */
  connect(url: string, accessToken: string, setupMessage: SetupMessage): void {
    this.closed = false;
    this.lastUrl = url;
    this.lastToken = accessToken;
    this.lastSetup = setupMessage;

    const wsUrl = `${url}?access_token=${accessToken}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      // Send setup message immediately
      this.ws?.send(JSON.stringify(setupMessage));

      // Start setup timeout
      this.setupTimeout = setTimeout(() => {
        if (!this.setupComplete) {
          this.events.onError('Connection setup timed out');
          this.close();
        }
      }, WS_SETUP_TIMEOUT_MS);
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.handleMessage(event.data);
    };

    this.ws.onerror = () => {
      this.events.onError('WebSocket connection error');
    };

    this.ws.onclose = (event: CloseEvent) => {
      this.cleanup();

      if (this.closed) {
        this.events.onClose(event.code, 'Session ended');
        return;
      }

      // Attempt reconnect for retryable errors
      if (
        isRetryableClose(event.code) &&
        this.reconnectAttempts < MAX_AUTO_RECONNECT_RETRIES &&
        this.circuitBreaker.canRequest()
      ) {
        this.attemptReconnect();
      } else {
        this.circuitBreaker.recordFailure();
        this.events.onClose(event.code, getErrorMessage(event.code));
      }
    };
  }

  /** Send audio data to the server */
  sendAudio(base64Pcm: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.setupComplete) return;

    this.ws.send(
      JSON.stringify({
        realtime_input: {
          media_chunks: [
            {
              mime_type: LIVE_INPUT_MIME,
              data: base64Pcm,
            },
          ],
        },
      })
    );
  }

  /** Send a client content message (e.g., activity interruption signal) */
  sendClientContent(content: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ client_content: content }));
  }

  /** Clean shutdown */
  close(): void {
    this.closed = true;
    this.cleanup();
    if (this.ws) {
      try {
        this.ws.close(1000, 'Client ended session');
      } catch {
        // Already closed
      }
      this.ws = null;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.setupComplete;
  }

  // ── Message handling ───────────────────────────────────────────

  private handleMessage(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return; // Ignore non-JSON
    }
    if (!isRecord(parsed)) return;
    const msg = parsed;

    // Top-level speech transcriptions (Vertex Live / BidiGenerateContent)
    const topIn = readTranscriptionChunk(msg.inputTranscription ?? msg.input_transcription);
    if (topIn) {
      this.events.onUserTranscript?.(topIn.text, topIn.finished);
      return;
    }
    const topOut = readTranscriptionChunk(msg.outputTranscription ?? msg.output_transcription);
    if (topOut) {
      this.events.onTranscript(topOut.text, topOut.finished);
      return;
    }

    // Setup complete
    if (msg.setupComplete) {
      this.setupComplete = true;
      if (this.setupTimeout) {
        clearTimeout(this.setupTimeout);
        this.setupTimeout = null;
      }
      this.startKeepalive();
      this.reconnectAttempts = 0;
      this.circuitBreaker.recordSuccess();
      this.events.onSetupComplete();
      return;
    }

    // Server content (audio and/or text)
    if (isRecord(msg.serverContent)) {
      const content = msg.serverContent;

      // Check for interruption (barge-in from server side)
      if (content.interrupted) {
        this.events.onInterrupted();
        return;
      }

      const inTx = readTranscriptionChunk(
        content.input_transcription ?? content.inputTranscription
      );
      if (inTx) {
        this.events.onUserTranscript?.(inTx.text, inTx.finished);
      }

      const outTx = readTranscriptionChunk(
        content.output_transcription ?? content.outputTranscription
      );
      if (outTx) {
        this.events.onTranscript(outTx.text, outTx.finished);
      }

      // Model turn content
      const modelTurn = isRecord(content.modelTurn) ? content.modelTurn : null;
      const parts = modelTurn && Array.isArray(modelTurn.parts) ? modelTurn.parts : null;
      if (parts) {
        for (const part of parts) {
          if (!isRecord(part)) continue;
          const inlineData = isRecord(part.inlineData) ? part.inlineData : null;
          const mimeType = inlineData?.mimeType;
          const data = inlineData?.data;
          if (
            typeof mimeType === 'string' &&
            mimeType.startsWith('audio/') &&
            typeof data === 'string'
          ) {
            this.events.onAudioData(data);
          }
          if (typeof part.text === 'string' && part.text) {
            this.events.onTranscript(part.text, false);
          }
        }
      }

      // Turn complete signal
      if (content.turnComplete) {
        // Mark last transcript as final
        this.events.onTranscript('', true);
      }
      return;
    }

    // Go away — server wants us to disconnect
    if (msg.goAway) {
      this.events.onError('Server requested disconnect');
      this.close();
      return;
    }

    // Tool call (future use)
    if (msg.toolCall) {
      // Not implemented yet — log for debugging
      console.log('[VoiceWS] Tool call received:', msg.toolCall);
    }
  }

  // ── Keepalive ──────────────────────────────────────────────────

  private startKeepalive(): void {
    this.stopKeepalive();
    this.keepaliveInterval = setInterval(() => {
      this.sendAudio(SILENT_KEEPALIVE_FRAME);
    }, WS_KEEPALIVE_INTERVAL_MS);
  }

  private stopKeepalive(): void {
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = null;
    }
  }

  // ── Reconnection ───────────────────────────────────────────────

  private attemptReconnect(): void {
    this.reconnectAttempts++;
    const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      if (this.closed) return;
      if (this.lastUrl && this.lastToken && this.lastSetup) {
        this.connect(this.lastUrl, this.lastToken, this.lastSetup);
      }
    }, delay);
  }

  // ── Cleanup ────────────────────────────────────────────────────

  private cleanup(): void {
    this.stopKeepalive();
    this.setupComplete = false;
    if (this.setupTimeout) {
      clearTimeout(this.setupTimeout);
      this.setupTimeout = null;
    }
  }
}
