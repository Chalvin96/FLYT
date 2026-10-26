import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';

import { dashboardKeys } from '@/hooks/dashboard/queries';
import { reviewKeys } from '@/hooks/review/queries';
import { useReviewSession } from '@/hooks/review/useReviewSession';
import type { ExerciseOutcome } from '@/lib/operationResult';
import { buildReviewExerciseAdapter } from '@/pages/ReviewSessionPage/reviewExerciseAdapter';
import { server } from '@/test/msw/server';
import type { ReviewResult, UserCard } from '@/types/api';

const NOW = Date.UTC(2026, 5, 26, 12);
const EMPTY_COUNTS = { new: 0, learning: 0, review: 0 };

function makeCard(
  id: number,
  state: UserCard['state'] = 'new',
  dueAt = NOW,
): UserCard {
  return {
    id,
    user_id: 1,
    pool_id: id,
    review_version: 0,
    due_at: new Date(dueAt).toISOString(),
    fsrs_difficulty: null,
    fsrs_stability: null,
    fsrs_step: null,
    last_review_at: null,
    state,
    card: {
      id: id * 10,
      deck_id: 1,
      type: 'definition',
      payload: {
        word: `word-${id}`,
        pos: 'noun',
        primary_translation: `translation-${id}`,
        definitions: [],
      },
    },
  };
}

function makeUnsupportedChooseCard(): UserCard {
  return {
    ...makeCard(1),
    card: {
      id: 10,
      deck_id: 1,
      type: 'choose',
      schema_version: 'unsupported',
      payload: {
        kind: 'exercise',
        id: 'unsupported-choose',
        operation: 'choose',
        objective_id: 'choose-objective',
        prompt: [{ kind: 'text', value: 'Choose a word.' }],
        explanation: null,
        payload: {
          options: [{ option_id: 'answer', text: 'ord' }],
          answer_id: 'answer',
        },
      },
    },
  };
}

function reviewResult(
  cardState: ReviewResult['card_state'] = 'review',
  dueAt = NOW + 86_400_000,
): ReviewResult {
  return {
    card_state: cardState,
    due_at: new Date(dueAt).toISOString(),
    new_remaining: 0,
    learning_remaining: 0,
    review_remaining: 0,
    review_version: 1,
  };
}

function newQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function serveDueCards(cards: UserCard[]) {
  server.use(http.get('*/me/cards/due', () => HttpResponse.json(cards)));
}

async function expectCard(
  result: { current: ReturnType<typeof useReviewSession> },
  id: number,
) {
  await waitFor(() => {
    expect(result.current.kind).toBe('card');
    if (result.current.kind === 'card') {
      expect(result.current.card.id).toBe(id);
    }
  });
}

async function submit(
  result: { current: ReturnType<typeof useReviewSession> },
  outcome: ExerciseOutcome,
) {
  if (result.current.kind !== 'card') throw new Error('Expected a card');
  const submitOutcome = result.current.submitOutcome;
  let accepted = false;
  await act(async () => {
    accepted = await submitOutcome(outcome);
  });
  expect(accepted).toBe(true);
}

async function expectCompletion(result: {
  current: ReturnType<typeof useReviewSession>;
}) {
  return waitFor(() => {
    const state = result.current;
    expect(state.kind).toBe('complete');
    if (state.kind !== 'complete') throw new Error('Expected completion');
    return state;
  });
}

describe('review session over MSW and a real QueryClient', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    focusManager.setFocused(undefined);
    onlineManager.setOnline(true);
    vi.restoreAllMocks();
  });

  it('test_review_session_given_graded_and_ungraded_outcomes_expect_next_counts_completion_and_accuracy', async () => {
    const submitted: Array<{ userCardId: number; body: unknown }> = [];
    serveDueCards([makeCard(1), makeCard(2), makeCard(3), makeCard(4)]);
    server.use(
      http.post(
        '*/me/cards/:userCardId/review',
        async ({ params, request }) => {
          submitted.push({
            userCardId: Number(params.userCardId),
            body: await request.json(),
          });
          return HttpResponse.json(reviewResult());
        },
      ),
    );

    const queryClient = newQueryClient();
    const { result, unmount } = renderHook(() => useReviewSession('full'), {
      wrapper: wrapper(queryClient),
    });

    await expectCard(result, 1);
    if (result.current.kind !== 'card') throw new Error('Expected a card');
    expect(result.current.ahead).toBe(false);
    expect(result.current.counts).toEqual({ new: 4, learning: 0, review: 0 });

    await submit(result, { kind: 'graded', correct: true, rating: 2 });
    await expectCard(result, 2);
    if (result.current.kind !== 'card') throw new Error('Expected a card');
    expect(result.current.counts).toEqual({ new: 3, learning: 0, review: 0 });
    expect(result.current.summary).toEqual({ reviewedCount: 1, accuracy: 100 });

    server.use(
      http.post('*/me/cards/2/review', async ({ request }) => {
        submitted.push({ userCardId: 2, body: await request.json() });
        return HttpResponse.json(reviewResult('learning', NOW + 60_000));
      }),
    );
    await submit(result, { kind: 'ungraded', outcome: 'skipped' });
    await expectCard(result, 3);
    if (result.current.kind !== 'card') throw new Error('Expected a card');
    expect(result.current.counts).toEqual({ new: 2, learning: 0, review: 0 });
    expect(result.current.summary).toEqual({ reviewedCount: 2, accuracy: 100 });

    server.use(
      http.post('*/me/cards/3/review', async ({ request }) => {
        submitted.push({ userCardId: 3, body: await request.json() });
        return HttpResponse.json(reviewResult('learning', NOW + 60_000));
      }),
    );
    await submit(result, {
      kind: 'ungraded',
      outcome: 'service_unavailable',
    });
    await expectCard(result, 4);
    if (result.current.kind !== 'card') throw new Error('Expected a card');
    expect(result.current.counts).toEqual({ new: 1, learning: 0, review: 0 });
    expect(result.current.summary).toEqual({ reviewedCount: 3, accuracy: 100 });

    await submit(result, { kind: 'graded', correct: false, rating: 4 });
    const complete = await expectCompletion(result);
    expect(complete.counts).toEqual(EMPTY_COUNTS);
    expect(complete.summary).toEqual({ reviewedCount: 4, accuracy: 50 });
    expect(submitted).toEqual([
      {
        userCardId: 1,
        body: { card_id: 10, outcome: 'graded', rating: 2, review_version: 0 },
      },
      {
        userCardId: 2,
        body: { card_id: 20, outcome: 'skipped', review_version: 0 },
      },
      {
        userCardId: 3,
        body: {
          card_id: 30,
          outcome: 'service_unavailable',
          review_version: 0,
        },
      },
      {
        userCardId: 4,
        body: { card_id: 40, outcome: 'graded', rating: 4, review_version: 0 },
      },
    ]);
    unmount();
    queryClient.clear();
  });

  it('test_review_session_given_unsupported_card_expect_unsupported_post_and_queue_removal', async () => {
    const submitted: unknown[] = [];
    serveDueCards([makeUnsupportedChooseCard()]);
    server.use(
      http.post('*/me/cards/1/review', async ({ request }) => {
        submitted.push(await request.json());
        return HttpResponse.json(reviewResult());
      }),
    );

    const queryClient = newQueryClient();
    const { result, unmount } = renderHook(() => useReviewSession('full'), {
      wrapper: wrapper(queryClient),
    });
    await expectCard(result, 1);
    if (result.current.kind !== 'card') throw new Error('Expected a card');
    const session = result.current;

    act(() => {
      buildReviewExerciseAdapter(session).onUnsupported();
    });

    const complete = await expectCompletion(result);
    expect(submitted).toEqual([
      { card_id: 10, outcome: 'unsupported', review_version: 0 },
    ]);
    expect(complete.counts).toEqual(EMPTY_COUNTS);
    expect(complete.summary).toEqual({ reviewedCount: 1, accuracy: null });
    unmount();
    queryClient.clear();
  });

  it('test_review_session_given_learning_requeue_expect_interleaving_studying_ahead_and_completion', async () => {
    serveDueCards([makeCard(1, 'learning'), makeCard(2, 'learning')]);
    server.use(
      http.post('*/me/cards/:userCardId/review', ({ params }) => {
        if (params.userCardId === '1') {
          return HttpResponse.json(reviewResult('learning', NOW + 60_000));
        }
        return HttpResponse.json(reviewResult());
      }),
    );

    const queryClient = newQueryClient();
    const { result, unmount } = renderHook(() => useReviewSession('quick'), {
      wrapper: wrapper(queryClient),
    });
    await expectCard(result, 1);
    const firstPresentation =
      result.current.kind === 'card' ? result.current.presentationKey : '';

    await submit(result, { kind: 'graded', correct: false, rating: 1 });
    await expectCard(result, 2);
    if (result.current.kind !== 'card') throw new Error('Expected a card');
    expect(result.current.counts).toEqual({ new: 0, learning: 2, review: 0 });

    await submit(result, { kind: 'graded', correct: true, rating: 4 });
    await expectCard(result, 1);
    if (result.current.kind !== 'card') throw new Error('Expected a card');
    expect(result.current.ahead).toBe(true);
    expect(result.current.presentationKey).not.toBe(firstPresentation);
    expect(result.current.counts).toEqual({ new: 0, learning: 1, review: 0 });

    server.use(
      http.post('*/me/cards/1/review', () => HttpResponse.json(reviewResult())),
    );
    await submit(result, { kind: 'graded', correct: true, rating: 4 });
    const complete = await expectCompletion(result);
    expect(complete.summary).toEqual({ reviewedCount: 3, accuracy: 67 });
    unmount();
    queryClient.clear();
  });

  it('test_review_session_given_learning_step_repeat_expect_returned_version_submitted', async () => {
    const submitted: unknown[] = [];
    let dueRequests = 0;
    server.use(
      http.get('*/me/cards/due', () => {
        dueRequests += 1;
        return HttpResponse.json([{ ...makeCard(1), review_version: 7 }]);
      }),
      http.post('*/me/cards/1/review', async ({ request }) => {
        submitted.push(await request.json());
        return HttpResponse.json(
          submitted.length === 1
            ? { ...reviewResult('learning', NOW + 60_000), review_version: 8 }
            : { ...reviewResult(), review_version: 9 },
        );
      }),
    );
    const queryClient = newQueryClient();
    const { result, unmount } = renderHook(() => useReviewSession('full'), {
      wrapper: wrapper(queryClient),
    });

    await expectCard(result, 1);
    await submit(result, { kind: 'graded', correct: false, rating: 1 });
    await expectCard(result, 1);
    await submit(result, { kind: 'graded', correct: true, rating: 3 });

    await expectCompletion(result);
    expect(submitted).toEqual([
      { card_id: 10, outcome: 'graded', rating: 1, review_version: 7 },
      { card_id: 10, outcome: 'graded', rating: 3, review_version: 8 },
    ]);
    expect(dueRequests).toBe(1);
    unmount();
    queryClient.clear();
  });

  it('test_review_session_given_stale_review_expect_readable_reload_message_and_unchanged_queue', async () => {
    serveDueCards([makeCard(1)]);
    const errorToast = vi.spyOn(toast, 'error');
    server.use(
      http.post('*/me/cards/1/review', () =>
        HttpResponse.json(
          {
            detail: {
              code: 'REVIEW_STALE',
              message: 'Review version is stale',
            },
          },
          { status: 409 },
        ),
      ),
    );
    const queryClient = newQueryClient();
    const { result, unmount } = renderHook(() => useReviewSession('full'), {
      wrapper: wrapper(queryClient),
    });
    await expectCard(result, 1);
    if (result.current.kind !== 'card') throw new Error('Expected a card');
    const submitOutcome = result.current.submitOutcome;

    await act(async () => {
      expect(
        await submitOutcome({ kind: 'graded', correct: true, rating: 3 }),
      ).toBe(false);
    });

    await expectCard(result, 1);
    if (result.current.kind !== 'card') throw new Error('Expected a card');
    expect(result.current.card.review_version).toBe(0);
    expect(result.current.summary).toEqual({
      reviewedCount: 0,
      accuracy: null,
    });
    expect(errorToast).toHaveBeenCalledWith(
      'This card was already answered in another tab. Reload to continue.',
    );
    unmount();
    queryClient.clear();
  });

  it('test_review_session_given_nothing_due_expect_empty_state_without_reviewed_cards', async () => {
    serveDueCards([]);
    const queryClient = newQueryClient();
    const { result, unmount } = renderHook(() => useReviewSession('full'), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.kind).toBe('empty'));
    expect(result.current).toEqual({ kind: 'empty' });
    unmount();
    queryClient.clear();
  });

  it('test_review_session_given_focus_and_reconnect_expect_no_due_card_refetch', async () => {
    let requests = 0;
    server.use(
      http.get('*/me/cards/due', () => {
        requests += 1;
        return HttpResponse.json([makeCard(1)]);
      }),
    );
    const queryClient = newQueryClient();
    const { result, unmount } = renderHook(() => useReviewSession('full'), {
      wrapper: wrapper(queryClient),
    });

    await expectCard(result, 1);
    expect(requests).toBe(1);
    await act(async () => focusManager.setFocused(false));
    await act(async () => focusManager.setFocused(true));
    await act(async () => onlineManager.setOnline(false));
    await act(async () => onlineManager.setOnline(true));
    expect(result.current.kind).toBe('card');
    expect(requests).toBe(1);
    unmount();
    queryClient.clear();
  });

  it('test_review_session_given_learning_due_later_expect_completion_with_later_today_hint', async () => {
    serveDueCards([makeCard(1, 'learning', NOW + 40 * 60_000)]);
    const queryClient = newQueryClient();
    const { result, unmount } = renderHook(() => useReviewSession('full'), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.kind).toBe('complete'));
    if (result.current.kind !== 'complete')
      throw new Error('Expected completion');
    expect(result.current.counts).toEqual({ new: 0, learning: 1, review: 0 });
    expect(result.current.summary).toEqual({
      reviewedCount: 0,
      accuracy: null,
    });
    unmount();
    queryClient.clear();
  });

  it('test_review_session_given_initial_issuance_failure_expect_retryable_error', async () => {
    let requests = 0;
    server.use(
      http.get('*/me/cards/due', () => {
        requests += 1;
        return requests === 1
          ? HttpResponse.json({ detail: 'Unavailable' }, { status: 503 })
          : HttpResponse.json([]);
      }),
    );
    const queryClient = newQueryClient();
    const { result, unmount } = renderHook(() => useReviewSession('full'), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.kind).toBe('error'));
    if (result.current.kind !== 'error') throw new Error('Expected error');
    expect(result.current.message).toBeTruthy();
    await act(async () => {
      if (result.current.kind === 'error') await result.current.retry();
    });
    await waitFor(() => expect(result.current.kind).toBe('empty'));
    expect(requests).toBe(2);
    unmount();
    queryClient.clear();
  });

  it('test_review_session_given_rejected_submission_expect_same_card_and_retryable_outcome', async () => {
    serveDueCards([makeCard(1)]);
    const errorToast = vi.spyOn(toast, 'error');
    let requests = 0;
    server.use(
      http.post('*/me/cards/1/review', () => {
        requests += 1;
        return requests === 1
          ? HttpResponse.json(
              {
                detail: {
                  code: 'INVALID_REVIEW_RATING',
                  message: 'Pick a valid rating.',
                },
              },
              { status: 400 },
            )
          : HttpResponse.json(reviewResult());
      }),
    );

    const queryClient = newQueryClient();
    const { result, unmount } = renderHook(() => useReviewSession('full'), {
      wrapper: wrapper(queryClient),
    });
    await expectCard(result, 1);
    if (result.current.kind !== 'card') throw new Error('Expected a card');
    const firstSubmit = result.current.submitOutcome;
    await act(async () => {
      expect(
        await firstSubmit({ kind: 'graded', correct: true, rating: 3 }),
      ).toBe(false);
    });
    await expectCard(result, 1);
    if (result.current.kind !== 'card') throw new Error('Expected a card');
    expect(result.current.summary).toEqual({
      reviewedCount: 0,
      accuracy: null,
    });
    expect(errorToast).toHaveBeenCalledWith(
      'INVALID_REVIEW_RATING - Pick a valid rating.',
    );

    await submit(result, { kind: 'graded', correct: true, rating: 3 });
    const complete = await expectCompletion(result);
    expect(complete.summary).toEqual({ reviewedCount: 1, accuracy: 100 });
    expect(requests).toBe(2);
    unmount();
    queryClient.clear();
  });

  it('test_review_session_given_overlapping_outcomes_expect_one_submission', async () => {
    serveDueCards([makeCard(1)]);
    let releaseResponse: () => void = () => {};
    const responsePending = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    let requests = 0;
    server.use(
      http.post('*/me/cards/1/review', async () => {
        requests += 1;
        await responsePending;
        return HttpResponse.json(reviewResult());
      }),
    );

    const queryClient = newQueryClient();
    const { result, unmount } = renderHook(() => useReviewSession('full'), {
      wrapper: wrapper(queryClient),
    });
    await expectCard(result, 1);
    if (result.current.kind !== 'card') throw new Error('Expected a card');
    const submitOutcome = result.current.submitOutcome;

    let first: Promise<boolean> = Promise.resolve(false);
    await act(async () => {
      first = submitOutcome({ kind: 'graded', correct: true, rating: 3 });
    });
    if (result.current.kind !== 'card') throw new Error('Expected a card');
    expect(result.current.isSubmitting).toBe(true);
    expect(
      await submitOutcome({ kind: 'graded', correct: true, rating: 4 }),
    ).toBe(false);
    releaseResponse();
    await act(async () => expect(await first).toBe(true));
    expect(requests).toBe(1);
    await waitFor(() => expect(result.current.kind).toBe('complete'));
    unmount();
    queryClient.clear();
  });

  it('test_review_session_given_leave_and_reentry_expect_cache_invalidation_and_fresh_issuance', async () => {
    let requests = 0;
    server.use(
      http.get('*/me/cards/due', () => {
        requests += 1;
        return HttpResponse.json([makeCard(requests)]);
      }),
    );
    const queryClient = newQueryClient();
    queryClient.setQueryData(reviewKeys.decks.all, []);
    queryClient.setQueryData(dashboardKeys.stats, {});

    const { result: firstResult, unmount: unmountFirst } = renderHook(
      () => useReviewSession('full'),
      {
        wrapper: wrapper(queryClient),
      },
    );
    await expectCard(firstResult, 1);
    expect(
      queryClient.getQueryState(reviewKeys.dueCards.byMode('full'))
        ?.isInvalidated,
    ).toBe(false);

    unmountFirst();
    await waitFor(() => {
      expect(
        queryClient.getQueryState(reviewKeys.dueCards.byMode('full'))
          ?.isInvalidated,
      ).toBe(true);
      expect(
        queryClient.getQueryState(reviewKeys.decks.all)?.isInvalidated,
      ).toBe(true);
      expect(
        queryClient.getQueryState(dashboardKeys.stats)?.isInvalidated,
      ).toBe(true);
    });

    const { result: secondResult, unmount: unmountSecond } = renderHook(
      () => useReviewSession('full'),
      {
        wrapper: wrapper(queryClient),
      },
    );
    expect(secondResult.current.kind).toBe('loading');
    await expectCard(secondResult, 2);
    expect(requests).toBe(2);
    unmountSecond();
    queryClient.clear();
  });
});
