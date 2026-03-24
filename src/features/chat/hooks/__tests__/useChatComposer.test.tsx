import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useChatComposer } from '../useChatComposer';

const parseMessageMock = vi.fn();

vi.mock('../useChatMessageParser', () => ({
  useChatMessageParser: () => ({
    parseMessage: parseMessageMock,
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'user-123',
      email: 'tester@chravelapp.com',
      avatar: undefined,
    },
  }),
}));

describe('useChatComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parseMessageMock.mockResolvedValue(true);
  });

  it('does not parse chat content before the message is persisted', async () => {
    const { result } = renderHook(() =>
      useChatComposer({
        tripId: 'trip-123',
        demoMode: false,
        isEvent: false,
      }),
    );

    act(() => {
      result.current.setInputMessage('https://example.com hello team');
    });

    await act(async () => {
      await result.current.sendMessage();
    });

    expect(parseMessageMock).not.toHaveBeenCalled();
  });
});
