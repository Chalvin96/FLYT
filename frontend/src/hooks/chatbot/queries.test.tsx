import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { getChatbotSurface, type ChatbotSurface } from '@/api/chatbot';
import { useChatbotSurface } from '@/hooks/chatbot/queries';

vi.mock('@/api/chatbot', () => ({
  getChatbotSurface: vi.fn(),
}));

const surface: ChatbotSurface = {
  models: [],
  openrouterKeyConfigured: false,
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

describe('useChatbotSurface', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('test_chatbot_surface_given_single_failed_request_expect_error_without_hidden_retries', async () => {
    const failure = new Error('availability unavailable');
    vi.mocked(getChatbotSurface).mockRejectedValue(failure);

    const { result } = renderHook(() => useChatbotSurface(7), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(getChatbotSurface).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe(failure);
  });

  it('test_chatbot_surface_given_explicit_refetch_expect_recovers', async () => {
    vi.mocked(getChatbotSurface)
      .mockRejectedValueOnce(new Error('availability unavailable'))
      .mockResolvedValueOnce(surface);

    const { result } = renderHook(() => useChatbotSurface(7), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getChatbotSurface).toHaveBeenCalledTimes(1);

    await result.current.refetch();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getChatbotSurface).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual(surface);
  });
});
