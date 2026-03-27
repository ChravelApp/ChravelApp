
import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioCapture } from '../voice/audioCapture';
import { AudioPlayback } from '../voice/audioPlayback';
import { VoiceWebSocketManager, VoiceWSEvents } from '../voice/VoiceWebSocketManager';
import { AdaptiveVad } from '../voice/adaptiveVad';
import { CircuitBreaker } from '../voice/circuitBreaker';
import { BARGE_IN_RMS_THRESHOLD } from '../voice/liveConstants';

// ── Types ──────────────────────────────────────────────────────────

export type VoiceState =
  | 'idle'
  | 'requesting_mic'
  | 'connecting'
  | 'ready'
  | 'listening'
  | 'processing'
  | 'playing'
  | 'error';

interface SessionConfig {
  edgeFunctionUrl: string;
  userId: string;
}

interface UseGeminiLiveReturn {
  state: VoiceState;
  startSession: () => Promise<void>;
  stopSession: () => void;
  userTranscript: string;
  aiTranscript: string;
  userRms: number;
  aiRms: number;
  error: string | null;
  circuitBreakerState: 'closed' | 'open' | 'half-open';
}

// ── Edge function URL ──────────────────────────────────────────────
const VOICE_SESSION_URL = '/api/gemini-voice-session';

// ── Hook ───────────────────────────────────────────────────────────

export function useGeminiLive(config: SessionConfig): UseGeminiLiveReturn {
  const [state, setState] = useState<VoiceState>('idle');
  const [userTranscript, setUserTranscript] = useState('');
  const [aiTranscript, setAiTranscript] = useState('');
  const [userRms, setUserRms] = useState(0);
  const [aiRms, setAiRms] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const captureRef = useRef<AudioCapture | null>(null);
  const playbackRef = useRef<AudioPlayback | null>(null);
  const wsRef = useRef<VoiceWebSocketManager | null>(null);
  const vadRef = useRef<AdaptiveVad>(new AdaptiveVad());
  const circuitBreakerRef = useRef<CircuitBreaker>(new CircuitBreaker());
  const stateRef = useRef<VoiceState>('idle');

  // Keep stateRef in sync for use in callbacks
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const [circuitBreakerState, setCircuitBreakerState] = useState(
    circuitBreakerRef.current.getState()
  );

  // ── Cleanup on unmount ───────────────────────────────────────────

  useEffect(() => {
    return () => {
      captureRef.current?.stop();
      playbackRef.current?.destroy();
      wsRef.current?.close();
    };
  }, []);

  // ── Stop session ─────────────────────────────────────────────────

  const stopSession = useCallback(() => {
    captureRef.current?.stop();
    captureRef.current = null;

    playbackRef.current?.destroy();
    playbackRef.current = null;

    wsRef.current?.close();
    wsRef.current = null;

    vadRef.current.reset();

    setState('idle');
    setUserRms(0);
    setAiRms(0);
    setError(null);
  }, []);

  // ── Start session ────────────────────────────────────────────────

  const startSession = useCallback(async () => {
    if (stateRef.current !== 'idle') return;

    // Check circuit breaker
    if (!circuitBreakerRef.current.canRequest()) {
      setError('Too many connection failures. Please try again later.');
      setCircuitBreakerState(circuitBreakerRef.current.getState());
      setState('error');
      return;
    }

    setError(null);
    setUserTranscript('');
    setAiTranscript('');

    // ── Step 1: Request mic ──────────────────────────────────────
    setState('requesting_mic');

    const capture = new AudioCapture();
    const playback = new AudioPlayback();
    captureRef.current = capture;
    playbackRef.current = playback;

    // ── Step 2: Get session token from edge function ─────────────
    setState('connecting');

    let sessionData: {
      accessToken: string;
      websocketUrl: string;
      setupMessage: any;
    };

    try {
      const url = config.edgeFunctionUrl || VOICE_SESSION_URL;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: config.userId }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Session request failed: ${response.status}`);
      }

      sessionData = await response.json();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create voice session';
      setError(msg);
      circuitBreakerRef.current.recordFailure();
      setCircuitBreakerState(circuitBreakerRef.current.getState());
      setState('error');
      return;
    }

    // ── Step 3: Connect WebSocket ────────────────────────────────
    const wsEvents: VoiceWSEvents = {
      onSetupComplete: () => {
        setState('ready');
        setCircuitBreakerState(circuitBreakerRef.current.getState());
        startMicCapture();
      },

      onAudioData: (base64Audio: string) => {
        if (stateRef.current !== 'error' && stateRef.current !== 'idle') {
          setState('playing');
          playbackRef.current?.enqueue(base64Audio);
          setAiRms(playbackRef.current?.getRms() || 0);
        }
      },

      onTranscript: (text: string, isFinal: boolean) => {
        if (text) {
          setAiTranscript((prev) => prev + text);
        }
        if (isFinal) {
          // Turn complete — go back to listening
          if (stateRef.current === 'playing' || stateRef.current === 'processing') {
            setState('listening');
          }
        }
      },

      onInterrupted: () => {
        // Server acknowledged barge-in
        playbackRef.current?.flush();
        setState('listening');
        setAiRms(0);
      },

      onError: (errMsg: string) => {
        setError(errMsg);
        circuitBreakerRef.current.recordFailure();
        setCircuitBreakerState(circuitBreakerRef.current.getState());
        setState('error');
      },

      onClose: (_code: number, reason: string) => {
        if (stateRef.current !== 'idle') {
          setError(reason);
          setState('error');
        }
      },
    };

    const ws = new VoiceWebSocketManager(wsEvents, circuitBreakerRef.current);
    wsRef.current = ws;

    ws.connect(sessionData.websocketUrl, sessionData.accessToken, sessionData.setupMessage);

    // ── Mic capture with VAD ─────────────────────────────────────
    const startMicCapture = async () => {
      try {
        vadRef.current.reset();

        await capture.start((base64Pcm: string, rms: number) => {
          setUserRms(rms);
          vadRef.current.feedFrame(rms);

          // Barge-in detection: user speaking during AI playback
          if (playbackRef.current?.isPlaying() && rms > BARGE_IN_RMS_THRESHOLD) {
            playbackRef.current.flush();
            setAiRms(0);
            // Send activity interruption signal
            wsRef.current?.sendClientContent({
              turn_complete: false,
              turns: [{ role: 'user', parts: [{ text: '[user interrupted]' }] }],
            });
          }

          // Only send audio when VAD detects speech (or during calibration)
          if (!vadRef.current.isCalibrated() || vadRef.current.isSpeaking()) {
            wsRef.current?.sendAudio(base64Pcm);

            if (vadRef.current.isCalibrated() && vadRef.current.isSpeaking()) {
              if (stateRef.current === 'ready' || stateRef.current === 'listening') {
                setState('listening');
              }
            }
          }
        });

        setState('listening');
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Microphone access denied';
        setError(msg);
        setState('error');
        ws.close();
      }
    };
  }, [config.edgeFunctionUrl, config.userId, stopSession]);

  return {
    state,
    startSession,
    stopSession,
    userTranscript,
    aiTranscript,
    userRms,
    aiRms,
    error,
    circuitBreakerState,
  };
}
