import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  STORY_GENERATION_POLL_INTERVAL_MS,
  useCurrentStoryGeneration,
} from '@/hooks/storyGeneration/queries';
import { type StoryGenerationCurrentResponse } from '@/types/api';

const api = vi.hoisted(() => ({
  createStoryGeneration: vi.fn(),
  getCurrentStoryGeneration: vi.fn(),
  getStoryGenerationSurface: vi.fn(),
  importCurrentStoryGeneration: vi.fn(),
}));

vi.mock('@/api/storyGeneration', () => api);

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function buildCurrent(
  status: StoryGenerationCurrentResponse['status'],
): StoryGenerationCurrentResponse {
  return {
    generationId: 42,
    status,
    provider: 'openrouter',
    anchor: 'frequency',
    length: 150,
    topic: null,
    pages: status === 'ready' ? [] : null,
    userStates: {},
    failureCode: status === 'failed' ? 'STORY_GENERATION_FAILED' : null,
    failureMessage: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
});

afterEach(() => {
  queryClient.clear();
});

describe('useCurrentStoryGeneration', () => {
  it('test_current_story_generation_given_processing_then_ready_expect_polling_stops', async () => {
    api.getCurrentStoryGeneration
      .mockResolvedValueOnce({
        ...buildCurrent('processing'),
        pages: null,
      })
      .mockResolvedValueOnce(buildCurrent('ready'));
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCurrentStoryGeneration(), {
      wrapper,
    });

    await waitFor(() => expect(result.current.data?.status).toBe('ready'), {
      timeout: STORY_GENERATION_POLL_INTERVAL_MS * 4,
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['story-generation', 'surface'],
    });

    const callsAfterTerminal = api.getCurrentStoryGeneration.mock.calls.length;
    await new Promise((resolve) => {
      setTimeout(resolve, STORY_GENERATION_POLL_INTERVAL_MS + 100);
    });

    expect(api.getCurrentStoryGeneration).toHaveBeenCalledTimes(
      callsAfterTerminal,
    );
  }, 6_000);
});
