import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { browseHeadword } from '@/api/lexicon';
import { useBrowseHeadword } from '@/hooks/lexicon/queries';

vi.mock('@/api/lexicon', () => ({
  browseHeadword: vi.fn(),
}));

describe('useBrowseHeadword', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls browseHeadword with trimmed query and caches under browse-headword key', async () => {
    const response = {
      headword: 'kjøre',
      entries: [
        { uuid: 'kjore-uuid-1', hgno: 1, label: 'kjøre' },
        { uuid: 'kjore-uuid-2', hgno: 2, label: 'kjøre' },
      ],
      selected_lemma_uuid: 'kjore-uuid-1',
      is_fallback: false,
    };
    vi.mocked(browseHeadword).mockResolvedValueOnce(response);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useBrowseHeadword('  kjøre  '), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(browseHeadword).toHaveBeenCalledTimes(1);
    expect(browseHeadword).toHaveBeenCalledWith('kjøre');
    expect(queryClient.getQueryData(['browse-headword', 'kjøre'])).toEqual(
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

    const { result } = renderHook(() => useBrowseHeadword('k'), {
      wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(browseHeadword).not.toHaveBeenCalled();
  });

  it('is disabled for whitespace-only queries', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useBrowseHeadword('   '), {
      wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(browseHeadword).not.toHaveBeenCalled();
  });
});
