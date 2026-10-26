import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { getChatGPTLink, type ChatGPTLink } from '@/api/chatgptLink';
import { useChatGPTLink } from '@/hooks/chatgptLink/queries';

vi.mock('@/api/chatgptLink', () => ({
  getChatGPTLink: vi.fn(),
}));

const link: ChatGPTLink = {
  state: 'absent',
  broken_reason: null,
  connected_at: null,
  pending: null,
  model: 'gpt-5.6-luna',
  available_models: ['gpt-5.6-luna'],
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 3, retryDelay: 0 } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('useChatGPTLink', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('test_chatgpt_link_given_failed_initial_load_expect_no_hidden_retries', async () => {
    const failure = new Error('link unavailable');
    vi.mocked(getChatGPTLink).mockRejectedValue(failure);

    const { result } = renderHook(() => useChatGPTLink(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(getChatGPTLink).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe(failure);
  });

  it('test_chatgpt_link_given_explicit_refetch_expect_recovers', async () => {
    vi.mocked(getChatGPTLink)
      .mockRejectedValueOnce(new Error('link unavailable'))
      .mockResolvedValueOnce(link);

    const { result } = renderHook(() => useChatGPTLink(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getChatGPTLink).toHaveBeenCalledTimes(1);

    await result.current.refetch();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getChatGPTLink).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual(link);
  });
});
