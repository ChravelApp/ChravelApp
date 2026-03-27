/** @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';
import { VoiceWebSocketManager } from '../VoiceWebSocketManager';
import { CircuitBreaker } from '../circuitBreaker';

describe('VoiceWebSocketManager transcription routing', () => {
  it('forwards input_transcription to onUserTranscript', () => {
    const onUserTranscript = vi.fn();
    const events = {
      onSetupComplete: vi.fn(),
      onAudioData: vi.fn(),
      onTranscript: vi.fn(),
      onUserTranscript,
      onInterrupted: vi.fn(),
      onError: vi.fn(),
      onClose: vi.fn(),
    };
    const mgr = new VoiceWebSocketManager(events, new CircuitBreaker());
    const handle = (mgr as unknown as { handleMessage: (raw: string) => void }).handleMessage.bind(
      mgr
    );

    handle(
      JSON.stringify({
        serverContent: {
          input_transcription: { text: 'hello', finished: false },
        },
      })
    );

    expect(onUserTranscript).toHaveBeenCalledWith('hello', false);
  });

  it('forwards top-level inputTranscription to onUserTranscript', () => {
    const onUserTranscript = vi.fn();
    const events = {
      onSetupComplete: vi.fn(),
      onAudioData: vi.fn(),
      onTranscript: vi.fn(),
      onUserTranscript,
      onInterrupted: vi.fn(),
      onError: vi.fn(),
      onClose: vi.fn(),
    };
    const mgr = new VoiceWebSocketManager(events, new CircuitBreaker());
    const handle = (mgr as unknown as { handleMessage: (raw: string) => void }).handleMessage.bind(
      mgr
    );

    handle(JSON.stringify({ inputTranscription: { text: 'hi', finished: true } }));

    expect(onUserTranscript).toHaveBeenCalledWith('hi', true);
  });

  it('forwards output_transcription to onTranscript', () => {
    const onTranscript = vi.fn();
    const events = {
      onSetupComplete: vi.fn(),
      onAudioData: vi.fn(),
      onTranscript,
      onInterrupted: vi.fn(),
      onError: vi.fn(),
      onClose: vi.fn(),
    };
    const mgr = new VoiceWebSocketManager(events, new CircuitBreaker());
    const handle = (mgr as unknown as { handleMessage: (raw: string) => void }).handleMessage.bind(
      mgr
    );

    handle(
      JSON.stringify({
        serverContent: {
          output_transcription: { text: 'reply', finished: false },
        },
      })
    );

    expect(onTranscript).toHaveBeenCalledWith('reply', false);
  });
});
