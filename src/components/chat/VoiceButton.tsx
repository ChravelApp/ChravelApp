
import React from 'react';
import { Mic, MicOff, Square } from 'lucide-react';
import type { VoiceState } from '../../hooks/useGeminiLive';

interface VoiceButtonProps {
  state: VoiceState;
  circuitBreakerState: 'closed' | 'open' | 'half-open';
  onStart: () => void;
  onStop: () => void;
}

export const VoiceButton = ({
  state,
  circuitBreakerState,
  onStart,
  onStop,
}: VoiceButtonProps) => {
  const isActive = state !== 'idle' && state !== 'error';
  const isDisabled = circuitBreakerState === 'open';
  const isConnecting = state === 'requesting_mic' || state === 'connecting';

  const handleClick = () => {
    if (isActive) {
      onStop();
    } else {
      onStart();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled || isConnecting}
      title={
        isDisabled
          ? 'Voice temporarily unavailable — too many connection failures'
          : isActive
            ? 'End voice session'
            : 'Start voice conversation'
      }
      className={`
        relative p-2 rounded-full transition-all duration-200
        ${
          isActive
            ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black shadow-lg shadow-yellow-500/30'
            : isDisabled
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-500 hover:from-yellow-500/30 hover:to-amber-500/30'
        }
      `}
    >
      {isActive ? (
        <Square size={16} />
      ) : isDisabled ? (
        <MicOff size={16} />
      ) : (
        <Mic size={16} />
      )}

      {/* Pulse ring when listening */}
      {(state === 'listening' || state === 'ready') && (
        <span className="absolute inset-0 rounded-full animate-ping bg-yellow-500/30" />
      )}

      {/* Connecting spinner */}
      {isConnecting && (
        <span className="absolute inset-0 rounded-full border-2 border-yellow-500/50 border-t-yellow-500 animate-spin" />
      )}
    </button>
  );
};
