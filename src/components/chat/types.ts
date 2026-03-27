
export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  groundingCards?: GroundingCard[];
  actions?: ChatActionCard[];
  isFromFallback?: boolean;
}

export interface GroundingCard {
  type: 'flight' | 'hotel' | 'place' | 'link';
  title: string;
  url: string;
  imageUrl?: string;
  snippet?: string;
  metadata?: Record<string, string>;
}

export interface ChatActionCard {
  type: 'poll' | 'task' | 'calendar';
  label: string;
  data: Record<string, string | number | boolean>;
}

export interface GeminiAPIConfig {
  temperature: number;
  topK: number;
  topP: number;
  maxOutputTokens: number;
}

export type VoiceState =
  | 'idle'
  | 'requesting_mic'
  | 'connecting'
  | 'ready'
  | 'listening'
  | 'processing'
  | 'playing'
  | 'error';
