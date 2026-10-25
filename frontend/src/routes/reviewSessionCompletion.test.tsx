import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';

import { reviewKeys } from '@/hooks/review/queries';
import { server } from '@/test/msw/server';
import type { UserCard } from '@/types/api';
import type { SessionLength } from '@/types/review';

import { Route as sessionRoute } from './_reviewSession.review.session';

const NOW = Date.UTC(2026, 9, 22, 12);

function buildCard(
  id: number,
  dueAt = '2026-10-22T11:00:00',
  state: UserCard['state'] = 'review',
): UserCard {
  return {
    id,
    user_id: 1,
    pool_id: id,
    due_at: dueAt,
    state,
    fsrs_difficulty: null,
    fsrs_stability: null,
    fsrs_step: null,
    review_version: 0,
    last_review_at: null,
    card: {
      id: id * 10,
      deck_id: 1,
      type: 'definition',
      payload: {
        word: `word-${id}`,
        pos: 'noun',
        primary_translation: 'word',
        definitions: [
          {
            uuid: `def-${id}`,
            definition: 'definition',
            translation: 'word',
            examples_json: [],
          },
        ],
      },
    },
  };
}

function renderSession(mode: SessionLength) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  if (mode === 'quick') {
    queryClient.setQueryDefaults(reviewKeys.dueCards.byMode('full'), {
      staleTime: Infinity,
    });
    queryClient.setQueryData(reviewKeys.dueCards.byMode('full'), []);
  }
  const rootRoute = createRootRoute();
  const layoutRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: '_reviewSession',
  });
  const reviewRoute = createRoute({
    getParentRoute: () => layoutRoute,
    path: '/review/session',
    validateSearch: sessionRoute.options.validateSearch,
    component: sessionRoute.options.component,
  });
  const router = createRouter({
    history: createMemoryHistory({
      initialEntries: [`/review/session?mode=${mode}`],
    }),
    routeTree: rootRoute.addChildren([
      layoutRoute.addChildren([reviewRoute]),
      createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        component: () => <div>Home destination</div>,
      }),
    ]),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { queryClient, router };
}

async function finishCard() {
  await userEvent.click(
    await screen.findByRole('button', { name: 'Check answer' }),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Good' }));
}

describe('review session completion through the session route', () => {
  beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(NOW));
  afterEach(() => vi.restoreAllMocks());

  async function expectFreshContinuation(mode: SessionLength) {
    let reviewed = false;
    const completionModes: Array<string | null> = [];
    server.use(
      http.get('*/me/cards/due', ({ request }) => {
        const requestedMode = new URL(request.url).searchParams.get('mode');
        if (!reviewed) return HttpResponse.json([buildCard(1)]);
        completionModes.push(requestedMode);
        return HttpResponse.json([
          buildCard(2),
          buildCard(3, '2026-10-22T15:00:00', 'learning'),
        ]);
      }),
      http.post('*/me/cards/1/review', () => {
        reviewed = true;
        return HttpResponse.json({
          card_state: 'review',
          due_at: '2026-10-23T12:00:00',
          new_remaining: 0,
          learning_remaining: 1,
          review_remaining: 1,
          review_version: 1,
        });
      }),
    );
    const { queryClient, router } = renderSession(mode);
    await finishCard();

    expect(
      await screen.findByText('1 card due now · more later today'),
    ).toBeInTheDocument();
    expect(completionModes).toEqual(['full']);
    expect(
      screen.getByText('1 card reviewed · 100% accuracy'),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Continue reviewing' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'word-2' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Check answer' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/card reviewed/)).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/review/session');
    expect(router.state.location.search).toEqual({ mode: 'full' });
    await waitFor(() => expect(completionModes).toEqual(['full', 'full']));
    queryClient.clear();
  }

  it('test_review_continuation_given_quick_completion_and_stale_full_cache_expect_refreshed_whole_queue_and_next_session', async () => {
    await expectFreshContinuation('quick');
  });

  it('test_review_continuation_given_full_completion_expect_new_session_on_the_same_url', async () => {
    await expectFreshContinuation('full');
  });

  it('test_review_completion_given_empty_queue_expect_shared_options_and_promoted_words_ready_to_review', async () => {
    let reviewed = false;
    let promoted = false;
    server.use(
      http.get('*/me/cards/due', () =>
        HttpResponse.json(
          !reviewed ? [buildCard(1)] : promoted ? [buildCard(2)] : [],
        ),
      ),
      http.post('*/me/cards/1/review', () => {
        reviewed = true;
        return HttpResponse.json({
          card_state: 'review',
          due_at: '2026-10-23T12:00:00',
          new_remaining: 0,
          learning_remaining: 0,
          review_remaining: 0,
          review_version: 1,
        });
      }),
      http.post('*/me/cards/add-more-new', () => {
        promoted = true;
        return HttpResponse.json({ promoted: 1 });
      }),
    );
    const { queryClient, router } = renderSession('full');
    await finishCard();

    expect(
      await screen.findByRole('heading', { name: "You're all caught up" }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reading' })).toHaveAttribute(
      'href',
      '/reading',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Add more new words' }),
    );
    expect(await screen.findByText('1 card due now')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to Home' }));
    expect(await screen.findByText('Home destination')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    queryClient.clear();
  });

  it('test_review_completion_given_failed_refresh_expect_summary_and_retry_then_later_today_hint', async () => {
    let reviewed = false;
    let refreshes = 0;
    server.use(
      http.get('*/me/cards/due', () => {
        if (!reviewed) return HttpResponse.json([buildCard(1)]);
        refreshes += 1;
        return refreshes === 1
          ? HttpResponse.json({ detail: 'Unavailable' }, { status: 503 })
          : HttpResponse.json([
              buildCard(2, '2026-10-22T15:00:00', 'relearning'),
            ]);
      }),
      http.post('*/me/cards/1/review', () => {
        reviewed = true;
        return HttpResponse.json({
          card_state: 'review',
          due_at: '2026-10-23T12:00:00',
          new_remaining: 0,
          learning_remaining: 1,
          review_remaining: 0,
          review_version: 1,
        });
      }),
    );
    const { queryClient } = renderSession('full');
    await finishCard();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load your review queue',
    );
    expect(
      screen.getByText('1 card reviewed · 100% accuracy'),
    ).toBeInTheDocument();
    expect(screen.queryByText("You're all caught up")).not.toBeInTheDocument();
    expect(screen.queryByText('Keep practicing')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(
      await screen.findByText('Nothing due now · more cards later today'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add more new words' }),
    ).toBeInTheDocument();
    expect(refreshes).toBe(2);
    queryClient.clear();
  });
});
