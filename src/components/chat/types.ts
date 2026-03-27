
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
  data: Record<string, any>;
}

export interface GeminiAPIConfig {
  temperature: number;
  topK: number;
  topP: number;
  maxOutputTokens: number;
}
