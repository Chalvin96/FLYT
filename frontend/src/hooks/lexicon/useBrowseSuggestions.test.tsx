import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { getSuggestions } from '@/api/lexicon';
import { useBrowseSuggestions } from '@/hooks/lexicon/queries';

vi.mock('@/api/lexicon', () => ({
  getSuggestions: vi.fn(),
}));

describe('useBrowseSuggestions', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls getSuggestions with trimmed query and caches under browse-suggestions key', async () => {
    const response = {
      suggestions: [{ label: 'kjøre' }, { label: 'kjøring' }],
    };
    vi.mocked(getSuggestions).mockResolvedValueOnce(response);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useBrowseSuggestions('  kjøre  '), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(getSuggestions).toHaveBeenCalledTimes(1);
    expect(getSuggestions).toHaveBeenCalledWith('kjøre');
    expect(queryClient.getQueryData(['browse-suggestions', 'kjøre'])).toEqual(
      response,
    );
  });

  it('is disabled for queries shorter than minimum length', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useBrowseSuggestions('k'), {
      wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getSuggestions).not.toHaveBeenCalled();
  });

  it('is disabled for whitespace-only queries', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useBrowseSuggestions('   '), {
      wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getSuggestions).not.toHaveBeenCalled();
  });
});
