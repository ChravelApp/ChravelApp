
import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

// Polyfill matchMedia for jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock useAuth globally - the pages require AuthProvider which isn't set up in tests
vi.mock('./hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user',
      email: 'test@example.com',
      displayName: 'Test User',
      isPro: false,
      permissions: [],
      notificationSettings: {
        messages: true,
        broadcasts: true,
        tripUpdates: true,
        email: true,
        push: true,
      },
    },
    isLoading: false,
    signIn: vi.fn(),
    signInWithPhone: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock useConsumerSubscription
vi.mock('./hooks/useConsumerSubscription', () => ({
  useConsumerSubscription: () => ({
    isPlus: false,
    subscription: null,
  }),
}));

// Mock @tanstack/react-query - pages use useQuery but tests don't wrap in QueryClientProvider
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: () => ({ data: undefined, isLoading: false, error: null }),
    useMutation: () => ({ mutate: vi.fn(), isLoading: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});
