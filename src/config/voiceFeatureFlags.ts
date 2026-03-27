
export const voiceFeatureFlags = {
  /** Master switch for Gemini Live voice mode */
  isVoiceLiveEnabled: import.meta.env.VITE_VOICE_LIVE_ENABLED === 'true',

  /** Show debug overlay with RMS, state, latency metrics */
  isDiagnosticsEnabled: import.meta.env.VITE_VOICE_DIAGNOSTICS_ENABLED === 'true',
} as const;
