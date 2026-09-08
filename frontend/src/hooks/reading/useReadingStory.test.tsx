import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  NOT_READY_POLL_INTERVAL_MS,
  useReadingStory,
} from '@/hooks/reading/queries';
import { type ReadingStoryPageResponse } from '@/types/api';

const { getReadingStory } = vi.hoisted(() => ({
  getReadingStory: vi.fn(),
}));

vi.mock('@/api/reading', () => ({
  getReadingStory,
}));

function buildStory(): ReadingStoryPageResponse {
  return {
    uuid: 'story-1',
    title: 'Story',
    cefrLevel: null,
    groupKey: null,
    groupTitle: null,
    page: { index: 0, content: 'hello', tokens: [] },
    totalPages: 1,
    lastPageIndex: 0,
    completed: false,
    userStates: {},
  };
}

function buildNotReadyError() {
  return Object.assign(new Error('Not ready'), {
    isAxiosError: true,
    response: {
      status: 409,
      data: {
        detail: {
          code: 'IMPORT_NOT_READY',
          message: 'Story is still processing.',
        },
      },
    },
    config: {},
  });
}

function buildGenericError() {
  return Object.assign(new Error('Boom'), {
    isAxiosError: true,
    response: {
      status: 500,
      data: { detail: { code: 'INTERNAL', message: 'Boom' } },
    },
    config: {},
  });
}

/**
 * Each test gets its own client that is torn down in `afterEach`, so a lingering
 * poll interval from one test can never fire against the next test's mock.
 */
let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// The poll interval is real time, so waits that must outlast a poll cycle use an
// explicit timeout comfortably above it; the per-test `it` timeout covers them.
const PAST_ONE_POLL = NOT_READY_POLL_INTERVAL_MS + 2000;

describe('useReadingStory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    // Cancel + drop everything so no interval survives into the next test.
    queryClient.clear();
    vi.restoreAllMocks();
  });

  it('test_reading_story_given_not_ready_error_expect_polls_until_ready', async () => {
    // The bug: the not-ready copy claims the page updates "automatically", but the
    // hook had no refetchInterval, so a direct reader URL stayed stuck on the
    // not-ready state until the user clicked "Check again".
    getReadingStory
      .mockRejectedValueOnce(buildNotReadyError())
      .mockRejectedValueOnce(buildNotReadyError())
      .mockResolvedValueOnce(buildStory());

    const { result } = renderHook(() => useReadingStory('story-1'), {
      wrapper,
    });

    // Two poll cycles (~6s) turn the third call into a success.
    await waitFor(() => expect(result.current.isSuccess).toBe(true), {
      timeout: 3 * NOT_READY_POLL_INTERVAL_MS,
    });
    expect(getReadingStory).toHaveBeenCalledTimes(3);
  }, 15_000);

  it('test_reading_story_given_success_expect_no_polling', async () => {
    // Polling must not start when the first fetch already succeeds.
    getReadingStory.mockResolvedValue(buildStory());

    const { result } = renderHook(() => useReadingStory('story-1'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, PAST_ONE_POLL));

    expect(getReadingStory).toHaveBeenCalledTimes(1);
  }, 15_000);

  it('test_reading_story_given_non_not_ready_error_expect_no_polling', async () => {
    // A hard failure (anything other than 409 IMPORT_NOT_READY) must NOT poll;
    // the user retries manually.
    getReadingStory.mockRejectedValue(buildGenericError());

    const { result } = renderHook(() => useReadingStory('story-1'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, PAST_ONE_POLL));

    expect(getReadingStory).toHaveBeenCalledTimes(1);
  }, 15_000);

  it('test_reading_story_given_poll_opt_out_expect_no_polling_even_when_not_ready', async () => {
    // The poll flag lets a caller that already polls the imports list opt out.
    getReadingStory.mockRejectedValue(buildNotReadyError());

    const { result } = renderHook(
      () => useReadingStory('story-1', undefined, { pollWhileNotReady: false }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, PAST_ONE_POLL));

    expect(getReadingStory).toHaveBeenCalledTimes(1);
  }, 15_000);
});
