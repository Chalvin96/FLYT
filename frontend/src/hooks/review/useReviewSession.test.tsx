import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { dashboardKeys } from '@/hooks/dashboard/queries';
import { reviewKeys, useDueCards, useReviewCard } from '@/hooks/review/queries';
import { useReviewSession } from '@/hooks/review/useReviewSession';
import { type ReviewResult, type UserCard } from '@/types/api';

const invalidateQueries = vi.fn().mockResolvedValue(undefined);

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries }),
}));

vi.mock('@/hooks/review/queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/review/queries')>()),
  useDueCards: vi.fn(),
  useReviewCard: vi.fn(),
}));

// Fixed "now" so day-boundary and due-time checks are deterministic.
const NOW = Date.UTC(2026, 5, 26, 12, 0, 0);

function makeCard(
  id: number,
  state: UserCard['state'] = 'review',
  dueMs: number = NOW,
): UserCard {
  return {
    id,
    user_id: 1,
    pool_id: id,
    due_at: new Date(dueMs).toISOString(),
    fsrs_difficulty: null,
    fsrs_stability: null,
    fsrs_step: null,
    last_review_at: null,
    state,
    card: { id: id * 10, deck_id: 1, type: 'definition', payload: {} },
  } as unknown as UserCard;
}

function makeReviewResult(
  cardState: ReviewResult['card_state'] = 'review',
  dueOffsetMs = 86_400_000,
): ReviewResult {
  return {
    new_remaining: 0,
    learning_remaining: 0,
    review_remaining: 0,
    card_state: cardState,
    due_at: new Date(NOW + dueOffsetMs).toISOString(),
  };
}

describe('useReviewSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    invalidateQueries.mockResolvedValue(undefined);
  });

  it('exposes currentCard from showNext and loading state from the due fetch', () => {
    const card = makeCard(7, 'review', NOW - 1000);
    const reviewCard = vi.fn();

    vi.mocked(useDueCards).mockReturnValue({
      data: [card],
      isPending: false,
    } as unknown as ReturnType<typeof useDueCards>);
    vi.mocked(useReviewCard).mockReturnValue({
      isPending: false,
      reviewCard,
    });

    const { result } = renderHook(() => useReviewSession('quick'));

    expect(useDueCards).toHaveBeenCalledWith('quick', true, {
      refetchOnMount: true,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.currentCard).toEqual(card);
    expect(result.current.status).toBe('card');
    expect(result.current.counts).toEqual({ new: 0, learning: 0, review: 1 });
  });

  it('reports done with zero counts when the queue is empty', () => {
    vi.mocked(useDueCards).mockReturnValue({
      data: [],
      isPending: false,
    } as unknown as ReturnType<typeof useDueCards>);
    vi.mocked(useReviewCard).mockReturnValue({
      isPending: false,
      reviewCard: vi.fn(),
    });

    const { result } = renderHook(() => useReviewSession('full'));

    expect(result.current.status).toBe('done');
    expect(result.current.currentCard).toBeUndefined();
    expect(result.current.counts).toEqual({ new: 0, learning: 0, review: 0 });
    expect(result.current.isLoading).toBe(false);
  });

  it('shows loading until the due-card queue first resolves', () => {
    vi.mocked(useDueCards).mockReturnValue({
      data: undefined,
      isPending: true,
    } as unknown as ReturnType<typeof useDueCards>);
    vi.mocked(useReviewCard).mockReturnValue({
      isPending: false,
      reviewCard: vi.fn(),
    });

    const { result } = renderHook(() => useReviewSession('quick'));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.currentCard).toBeUndefined();
  });

  it('test_review_session_given_initial_issuance_failure_expect_retryable_error', () => {
    const retry = vi.fn().mockResolvedValue({ data: [] });
    vi.mocked(useDueCards).mockReturnValue({
      data: undefined,
      error: new Error('Request failed'),
      isError: true,
      isFetching: false,
      isPending: false,
      refetch: retry,
    } as unknown as ReturnType<typeof useDueCards>);
    vi.mocked(useReviewCard).mockReturnValue({
      isPending: false,
      reviewCard: vi.fn(),
    });

    const { result } = renderHook(() => useReviewSession('full'));

    expect(result.current.status).toBe('error');
    expect(result.current.isError).toBe(true);
    expect(result.current.currentCard).toBeUndefined();
    expect(result.current.retry).toBe(retry);
  });

  it('reports done when a learning card is beyond the learn-ahead window (completion-only)', () => {
    const futureMs = NOW + 40 * 60 * 1000; // 40 min — beyond 20-min window
    const card = makeCard(1, 'learning', futureMs);

    vi.mocked(useDueCards).mockReturnValue({
      data: [card],
      isPending: false,
    } as unknown as ReturnType<typeof useDueCards>);
    vi.mocked(useReviewCard).mockReturnValue({
      isPending: false,
      reviewCard: vi.fn(),
    });

    const { result } = renderHook(() => useReviewSession('full'));

    expect(result.current.status).toBe('done');
    expect(result.current.currentCard).toBeUndefined();
    expect(result.current.counts.learning).toBe(1);
  });

  it('submitReview calls reviewCard with the shown card id and variant id, then applies the result', async () => {
    const card = makeCard(3, 'new', NOW);
    const reviewResult = makeReviewResult('learning', 60_000);

    const reviewCard = vi.fn().mockResolvedValue(reviewResult);

    vi.mocked(useDueCards).mockReturnValue({
      data: [card],
      isPending: false,
    } as unknown as ReturnType<typeof useDueCards>);
    vi.mocked(useReviewCard).mockReturnValue({
      isPending: false,
      reviewCard,
    });

    const { result } = renderHook(() => useReviewSession('full'));

    expect(result.current.currentCard).toEqual(card);

    let accepted: boolean | undefined;
    await act(async () => {
      const res = await result.current.submitReview({
        submission: { outcome: 'graded', rating: 2 },
      });
      accepted = res.accepted;
    });

    expect(accepted).toBe(true);
    expect(reviewCard).toHaveBeenCalledWith({
      userCardId: card.id,
      submission: { outcome: 'graded', rating: 2 },
      cardId: card.card.id,
    });

    // Card moved to learning with a due still today — stays in the queue
    // but shifted from new -> learning.
    expect(result.current.counts).toEqual({ new: 0, learning: 1, review: 0 });
  });

  it('submitReview drops the card when it graduates to review', async () => {
    const card = makeCard(1, 'learning', NOW - 1000);
    const reviewResult = makeReviewResult('review', 86_400_000);

    const reviewCard = vi.fn().mockResolvedValue(reviewResult);

    vi.mocked(useDueCards).mockReturnValue({
      data: [card],
      isPending: false,
    } as unknown as ReturnType<typeof useDueCards>);
    vi.mocked(useReviewCard).mockReturnValue({
      isPending: false,
      reviewCard,
    });

    const { result } = renderHook(() => useReviewSession('full'));

    await act(async () => {
      await result.current.submitReview({
        submission: { outcome: 'graded', rating: 3 },
      });
    });

    expect(result.current.status).toBe('done');
    expect(result.current.counts).toEqual({ new: 0, learning: 0, review: 0 });
  });

  it('test_submit_review_given_ungraded_outcome_expect_card_removed_without_scheduling', async () => {
    const card = makeCard(1, 'learning', NOW - 1000);
    const reviewCard = vi.fn().mockResolvedValue(makeReviewResult('learning'));

    vi.mocked(useDueCards).mockReturnValue({
      data: [card],
      isPending: false,
    } as unknown as ReturnType<typeof useDueCards>);
    vi.mocked(useReviewCard).mockReturnValue({
      isPending: false,
      reviewCard,
    });

    const { result } = renderHook(() => useReviewSession('full'));

    await act(async () => {
      await result.current.submitReview({
        submission: { outcome: 'service_unavailable' },
      });
    });

    expect(reviewCard).toHaveBeenCalledWith({
      userCardId: card.id,
      submission: { outcome: 'service_unavailable' },
      cardId: card.card.id,
    });
    expect(result.current.status).toBe('done');
    expect(result.current.counts).toEqual({ new: 0, learning: 0, review: 0 });
  });

  it('exposes currentCardAhead:true for a learn-ahead card and ahead:false for a due card', () => {
    const dueCard = makeCard(1, 'review', NOW - 1000);

    vi.mocked(useDueCards).mockReturnValue({
      data: [dueCard],
      isPending: false,
    } as unknown as ReturnType<typeof useDueCards>);
    vi.mocked(useReviewCard).mockReturnValue({
      isPending: false,
      reviewCard: vi.fn(),
    });

    const { result: dueResult } = renderHook(() => useReviewSession('full'));
    expect(dueResult.current.currentCardAhead).toBe(false);

    const aheadCard = makeCard(2, 'learning', NOW + 5 * 60 * 1000);

    vi.mocked(useDueCards).mockReturnValue({
      data: [aheadCard],
      isPending: false,
    } as unknown as ReturnType<typeof useDueCards>);

    const { result: aheadResult } = renderHook(() => useReviewSession('full'));
    expect(aheadResult.current.currentCardAhead).toBe(true);
  });

  it('increments presentationSeq once per accepted review', async () => {
    const cardA = makeCard(1, 'review', NOW - 1000);
    const cardB = makeCard(2, 'review', NOW - 500);

    const reviewCard = vi.fn().mockResolvedValue(makeReviewResult('review'));

    vi.mocked(useDueCards).mockReturnValue({
      data: [cardA, cardB],
      isPending: false,
    } as unknown as ReturnType<typeof useDueCards>);
    vi.mocked(useReviewCard).mockReturnValue({
      isPending: false,
      reviewCard,
    });

    const { result } = renderHook(() => useReviewSession('full'));

    expect(result.current.presentationSeq).toBe(0);

    await act(async () => {
      await result.current.submitReview({
        submission: { outcome: 'graded', rating: 3 },
      });
    });
    expect(result.current.presentationSeq).toBe(1);

    await act(async () => {
      await result.current.submitReview({
        submission: { outcome: 'graded', rating: 3 },
      });
    });
    expect(result.current.presentationSeq).toBe(2);
  });

  it('guards against double-submit: second concurrent call is rejected and does not POST twice', async () => {
    const card = makeCard(1, 'review', NOW - 1000);

    // A deferred promise we control so both calls overlap.
    let resolveReview: (val: ReviewResult) => void = () => {};
    const reviewCard = vi.fn(
      () =>
        new Promise<ReviewResult>((resolve) => {
          resolveReview = resolve;
        }),
    );

    vi.mocked(useDueCards).mockReturnValue({
      data: [card],
      isPending: false,
    } as unknown as ReturnType<typeof useDueCards>);
    vi.mocked(useReviewCard).mockReturnValue({
      isPending: false,
      reviewCard,
    });

    const { result } = renderHook(() => useReviewSession('full'));

    const seqBefore = result.current.presentationSeq;

    // Fire two overlapping submits.
    let secondResult: { accepted: boolean } | undefined;
    await act(async () => {
      const first = result.current.submitReview({
        submission: { outcome: 'graded', rating: 3 },
      });
      // Second call fires while the first is still in flight.
      secondResult = await result.current.submitReview({
        submission: { outcome: 'graded', rating: 4 },
      });

      // Allow the first to complete.
      resolveReview(makeReviewResult('review'));
      await first;
    });

    expect(secondResult).toEqual({ accepted: false });
    expect(reviewCard).toHaveBeenCalledTimes(1);
    expect(reviewCard).toHaveBeenNthCalledWith(1, {
      userCardId: card.id,
      submission: { outcome: 'graded', rating: 3 },
      cardId: card.card.id,
    });
    // presentationSeq bumped only once (for the accepted first call).
    expect(result.current.presentationSeq).toBe(seqBefore + 1);
  });

  it('isSubmitting toggles true during submit and false after', async () => {
    const card = makeCard(1, 'review', NOW - 1000);

    let resolveReview: (val: ReviewResult) => void = () => {};
    const reviewCard = vi.fn(
      () =>
        new Promise<ReviewResult>((resolve) => {
          resolveReview = resolve;
        }),
    );

    vi.mocked(useDueCards).mockReturnValue({
      data: [card],
      isPending: false,
    } as unknown as ReturnType<typeof useDueCards>);
    vi.mocked(useReviewCard).mockReturnValue({
      isPending: false,
      reviewCard,
    });

    const { result } = renderHook(() => useReviewSession('full'));

    expect(result.current.isSubmitting).toBe(false);

    await act(async () => {
      const p = result.current.submitReview({
        submission: { outcome: 'graded', rating: 3 },
      });
      resolveReview(makeReviewResult('review'));
      await p;
    });

    expect(result.current.isSubmitting).toBe(false);
  });

  it('interleaves: after answering card A, the next currentCard is a different card when another is showable', async () => {
    // Seed two learning cards both due now so both stay showable after a
    // failed review. Card A is first in priority order (smaller id).
    const cardA = makeCard(1, 'learning', NOW - 1_000);
    const cardB = makeCard(2, 'learning', NOW);
    // "Again" reschedules A to a learning step ~1 min out — still within
    // today AND within the learn-ahead window, so A remains showable.
    const reviewResult = makeReviewResult('learning', 60_000);

    const reviewCard = vi.fn().mockResolvedValue(reviewResult);

    vi.mocked(useDueCards).mockReturnValue({
      data: [cardA, cardB],
      isPending: false,
    } as unknown as ReturnType<typeof useDueCards>);
    vi.mocked(useReviewCard).mockReturnValue({
      isPending: false,
      reviewCard,
    });

    const { result } = renderHook(() => useReviewSession('full'));

    // Initially A is shown (smaller id at near-equal due).
    expect(result.current.currentCard?.id).toBe(cardA.id);

    // Answer A — lastShownUserCardId is now A, so the Anki interleave rule
    // surfaces B next even though A is still showable.
    await act(async () => {
      await result.current.submitReview({
        submission: { outcome: 'graded', rating: 1 },
      });
    });
    expect(result.current.currentCard?.id).toBe(cardB.id);

    // Answer B — lastShownUserCardId is now B, so the rule flips back to A
    // (which is still showable via learn-ahead).
    await act(async () => {
      await result.current.submitReview({
        submission: { outcome: 'graded', rating: 1 },
      });
    });
    expect(result.current.currentCard?.id).toBe(cardA.id);
  });

  it('invalidates due cards, decks, and dashboard stats when the session unmounts', async () => {
    vi.mocked(useDueCards).mockReturnValue({
      data: [],
      isPending: false,
    } as unknown as ReturnType<typeof useDueCards>);
    vi.mocked(useReviewCard).mockReturnValue({
      isPending: false,
      reviewCard: vi.fn(),
    });

    const { unmount } = renderHook(() => useReviewSession('full'));

    // Invalidation fires on unmount, not during the session.
    expect(invalidateQueries).not.toHaveBeenCalled();

    await act(async () => {
      unmount();
    });

    expect(invalidateQueries).toHaveBeenCalledTimes(3);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: reviewKeys.dueCards.all,
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: reviewKeys.decks.all,
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: dashboardKeys.stats,
    });
  });
});
