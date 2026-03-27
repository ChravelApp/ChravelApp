
import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import type { VoiceState } from '../../hooks/useGeminiLive';

interface VoiceLiveInlineProps {
  state: VoiceState;
  userRms: number;
  aiRms: number;
  userTranscript: string;
  aiTranscript: string;
  error: string | null;
  onStop: () => void;
}

const BAR_COUNT = 24;

export const VoiceLiveInline = ({
  state,
  userRms,
  aiRms,
  userTranscript,
  aiTranscript,
  error,
  onStop,
}: VoiceLiveInlineProps) => {
  // Determine which RMS drives the waveform
  const activeRms = state === 'playing' ? aiRms : userRms;

  // Generate bar heights from RMS + some randomization for natural look
  const bars = useMemo(() => {
    return Array.from({ length: BAR_COUNT }, (_, i) => {
      const center = BAR_COUNT / 2;
      const distFromCenter = Math.abs(i - center) / center;
      const baseHeight = Math.max(0.05, activeRms * 10 * (1 - distFromCenter * 0.6));
      // Add slight variation per bar
      const variation = 0.7 + Math.random() * 0.6;
      return Math.min(1, baseHeight * variation);
    });
  }, [activeRms]);

  const statusLabel = (() => {
    switch (state) {
      case 'requesting_mic':
        return 'Requesting microphone...';
      case 'connecting':
        return 'Connecting...';
      case 'ready':
        return 'Microphone ready';
      case 'listening':
        return 'Listening...';
      case 'processing':
        return 'Processing...';
      case 'playing':
        return 'Speaking...';
      case 'error':
        return error || 'Connection error';
      default:
        return '';
    }
  })();

  const glowIntensity = Math.min(1, activeRms * 15);

  return (
    <div className="relative bg-gray-900/95 backdrop-blur-sm rounded-2xl border border-yellow-500/30 p-6 overflow-hidden">
      {/* Golden glow background */}
      <div
        className="absolute inset-0 rounded-2xl transition-opacity duration-150"
        style={{
          background: `radial-gradient(ellipse at center, rgba(234, 179, 8, ${glowIntensity * 0.15}) 0%, transparent 70%)`,
        }}
      />

      {/* Close button */}
      <button
        onClick={onStop}
        className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-gray-800/80 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
      >
        <X size={14} />
      </button>

      {/* AI transcript (above waveform) */}
      <div className="relative z-10 min-h-[2rem] mb-4 text-center">
        {aiTranscript && (
          <p className="text-white text-sm leading-relaxed animate-fade-in line-clamp-3">
            {aiTranscript}
          </p>
        )}
      </div>

      {/* Waveform bars */}
      <div className="relative z-10 flex items-center justify-center gap-[2px] h-16 mb-4">
        {bars.map((height, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-75"
            style={{
              width: '3px',
              height: `${Math.max(4, height * 64)}px`,
              backgroundColor:
                state === 'playing'
                  ? `rgba(234, 179, 8, ${0.5 + height * 0.5})`
                  : state === 'listening'
                    ? `rgba(234, 179, 8, ${0.4 + height * 0.6})`
                    : 'rgba(234, 179, 8, 0.2)',
            }}
          />
        ))}
      </div>

      {/* User transcript (below waveform) */}
      <div className="relative z-10 min-h-[1.5rem] mb-3 text-center">
        {userTranscript && (
          <p className="text-yellow-400 text-sm leading-relaxed line-clamp-2">
            {userTranscript}
          </p>
        )}
      </div>

      {/* Status label */}
      <div className="relative z-10 text-center">
        <span
          className={`text-xs font-medium ${
            state === 'error' ? 'text-red-400' : 'text-gray-500'
          }`}
        >
          {statusLabel}
        </span>
      </div>
    </div>
  );
};
