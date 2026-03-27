
import React, { useMemo, useRef, useEffect } from 'react';
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

const BAR_COUNT = 32;

export const VoiceLiveInline = ({
  state,
  userRms,
  aiRms,
  userTranscript,
  aiTranscript,
  error,
  onStop,
}: VoiceLiveInlineProps) => {
  const aiScrollRef = useRef<HTMLDivElement>(null);
  const activeRms = state === 'playing' ? aiRms : userRms;

  // Auto-scroll AI transcript as new text arrives
  useEffect(() => {
    if (aiScrollRef.current) {
      aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight;
    }
  }, [aiTranscript]);

  // Generate bar heights from RMS + variation for natural look
  const bars = useMemo(() => {
    return Array.from({ length: BAR_COUNT }, (_, i) => {
      const center = BAR_COUNT / 2;
      const distFromCenter = Math.abs(i - center) / center;
      const baseHeight = Math.max(0.05, activeRms * 12 * (1 - distFromCenter * 0.5));
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
    <div className="relative flex flex-col h-full min-h-[400px] bg-gray-900/95 backdrop-blur-sm rounded-2xl border border-yellow-500/30 overflow-hidden">
      {/* Golden glow background */}
      <div
        className="absolute inset-0 rounded-2xl transition-opacity duration-150 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, rgba(234, 179, 8, ${glowIntensity * 0.12}) 0%, transparent 70%)`,
        }}
      />

      {/* Close button */}
      <button
        onClick={onStop}
        className="absolute top-3 right-3 z-10 p-2 rounded-full bg-gray-800/80 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
      >
        <X size={16} />
      </button>

      {/* ── Top half: AI transcript ────────────────────────────── */}
      <div
        ref={aiScrollRef}
        className="relative z-10 flex-1 flex flex-col justify-end px-6 pt-8 pb-4 overflow-y-auto"
      >
        {aiTranscript ? (
          <p className="text-white text-base leading-relaxed text-center">
            {aiTranscript}
          </p>
        ) : (
          state !== 'idle' && (
            <p className="text-gray-600 text-sm text-center">
              {state === 'playing' ? '' : 'AI response will appear here...'}
            </p>
          )
        )}
      </div>

      {/* ── Center: Waveform ───────────────────────────────────── */}
      <div className="relative z-10 flex-shrink-0 flex items-center justify-center gap-[2px] h-20 px-6">
        {bars.map((height, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-75"
            style={{
              width: '3px',
              height: `${Math.max(4, height * 72)}px`,
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

      {/* ── Bottom half: User transcript + status ──────────────── */}
      <div className="relative z-10 flex-1 flex flex-col justify-start px-6 pt-4 pb-6 overflow-y-auto">
        {userTranscript ? (
          <p className="text-yellow-400 text-base leading-relaxed text-center">
            {userTranscript}
          </p>
        ) : (
          state === 'listening' && (
            <p className="text-gray-600 text-sm text-center">
              Speak now...
            </p>
          )
        )}

        {/* Status label at the very bottom */}
        <div className="mt-auto pt-4 text-center">
          <span
            className={`text-xs font-medium ${
              state === 'error' ? 'text-red-400' : 'text-gray-500'
            }`}
          >
            {statusLabel}
          </span>
        </div>
      </div>
    </div>
  );
};
