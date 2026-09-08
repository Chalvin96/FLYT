import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PropsWithChildren, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { getDueCards } from '@/api/review';
import { useReviewSession } from '@/hooks/review/useReviewSession';
import type { UserCard } from '@/types/api';

vi.mock('@/api/review', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/review')>()),
  getDueCards: vi.fn(),
}));

const NOW = Date.UTC(2026, 5, 26, 12, 0, 0);

function makeCard(id: number): UserCard {
  return {
    id,
    user_id: 1,
    pool_id: id,
    due_at: new Date(NOW - 1000).toISOString(),
    fsrs_difficulty: null,
    fsrs_stability: null,
    fsrs_step: null,
    last_review_at: null,
    state: 'review',
    card: { id: id * 10, deck_id: 1, type: 'definition', payload: {} },
  } as unknown as UserCard;
}

function makeWrapper(queryClient: QueryClient) {
  return function QueryClientWrapper({
    children,
  }: PropsWithChildren): ReactNode {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('useReviewSession lifecycle', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    vi.mocked(getDueCards).mockReset();
  });

  it('test_review_session_given_resolved_cache_on_reentry_expect_current_issuance_data', async () => {
    const priorCard = makeCard(1);
    const currentCard = makeCard(2);
    vi.mocked(getDueCards)
      .mockResolvedValueOnce([priorCard])
      .mockResolvedValueOnce([currentCard]);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = makeWrapper(queryClient);

    const { result: firstResult, unmount: unmountFirst } = renderHook(
      () => useReviewSession('full'),
      { wrapper },
    );
    await waitFor(() => {
      expect(firstResult.current.currentCard?.id).toBe(priorCard.id);
    });

    await act(async () => {
      unmountFirst();
    });

    const { result: secondResult, unmount: unmountSecond } = renderHook(
      () => useReviewSession('full'),
      {
        wrapper,
      },
    );
    expect(secondResult.current.currentCard).toBeUndefined();

    await waitFor(() => {
      expect(secondResult.current.currentCard?.id).toBe(currentCard.id);
    });
    expect(getDueCards).toHaveBeenCalledTimes(2);

    unmountSecond();
    queryClient.clear();
  });
});
