import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { useLinkPreviews } from '../useLinkPreviews';

const { mockFetchOGMetadata } = vi.hoisted(() => ({
  mockFetchOGMetadata: vi.fn(),
}));

vi.mock('@/services/ogMetadataService', () => ({
  fetchOGMetadata: (...args: unknown[]) => mockFetchOGMetadata(...args),
}));

describe('useLinkPreviews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies one fetched preview to every message with the same URL', async () => {
    mockFetchOGMetadata.mockResolvedValue({
      title: 'Example',
      description: 'Example description',
      image: 'https://example.com/image.png',
    });

    const messages = [
      { id: 'm1', text: 'First link https://example.com/page' },
      { id: 'm2', text: 'Second link same URL https://example.com/page' },
    ];

    const { result } = renderHook(() => useLinkPreviews(messages));

    await waitFor(() => {
      expect(result.current.m1).toBeDefined();
    });

    await waitFor(() => {
      expect(result.current.m2).toBeDefined();
    });

    expect(result.current.m1?.title).toBe('Example');
    expect(result.current.m2?.title).toBe('Example');
    expect(mockFetchOGMetadata).toHaveBeenCalledTimes(1);
  });
});
