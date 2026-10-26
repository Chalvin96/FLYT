import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw/http';
import { describe, expect, it, vi } from 'vitest';
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';

import { dashboardKeys } from '@/hooks/dashboard/queries';
import { reviewKeys } from '@/hooks/review/queries';
import { server } from '@/test/msw/server';
import { createStoryRouter } from '@/test/router';
import type { LessonDetailRead, UserCard } from '@/types/api';

import { LessonDetailSession } from './LessonDetailSession';

const lesson: LessonDetailRead = {
  id: 42,
  source_id: 'cafe-order',
  kind: 'communicative',
  family_id: 'basics',
  title: 'At the café',
  cefr_level: 'A1',
  goal: 'Order at a café.',
  order: 1,
  estimated_minutes: 5,
  packet: {
    schema_version: '4.0',
    id: 'cafe-order',
    kind: 'communicative',
    language: 'nb-NO',
    title: 'At the café',
    cefr_level: 'A1',
    goal: 'Order at a café.',
    objectives: [],
    content: [],
    sections: [],
    exercises: [],
    practice_groups: [],
    media: { audio: [] },
  },
  media: { audio: [] },
  progress: { completed_exercise_ids: [], completed_at: null },
};

function buildCard(id: number): UserCard {
  return {
    id,
    user_id: 7,
    pool_id: id,
    due_at: '2026-10-18T00:00:00Z',
    fsrs_difficulty: null,
    fsrs_stability: null,
    fsrs_step: null,
    review_version: 0,
    last_review_at: null,
    state: 'new',
    card: {
      id: id * 10,
      deck_id: 99,
      type: 'definition',
      payload: {
        word: 'kaffe',
        pos: 'noun',
        primary_translation: 'coffee',
        definitions: [],
      },
    },
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderCompletion(queryClient = createQueryClient()) {
  const onExit = vi.fn();
  const router = createStoryRouter(
    <QueryClientProvider client={queryClient}>
      <LessonDetailSession lesson={lesson} userId={7} onExit={onExit} />
    </QueryClientProvider>,
    ['/lesson/42'],
    ['/lesson/$id', '/lesson'],
  );
  render(<RouterProvider router={router} />);
  return { onExit, queryClient, router };
}

describe('lesson completion', () => {
  it('test_lesson_completion_given_eligible_whole_queue_expect_real_quick_count_and_review_destination', async () => {
    const user = userEvent.setup();
    const requests: string[] = [];
    server.use(
      http.post('*/lessons/42/complete', () => {
        requests.push('saved');
        return new HttpResponse(null, { status: 204 });
      }),
      http.get('*/me/cards/due', ({ request }) => {
        requests.push(new URL(request.url).search);
        return HttpResponse.json([buildCard(1), buildCard(2), buildCard(3)]);
      }),
    );
    const { onExit } = renderCompletion();

    await user.click(
      await screen.findByRole('button', { name: 'Review 3 cards' }),
    );

    expect(requests).toEqual(['saved', '?mode=quick']);
    expect(onExit).toHaveBeenCalledWith('review');
    expect(screen.getByText(/now in your review queue/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Back to lessons' }),
    ).toHaveAttribute('href', '/lesson');
  });

  it('test_lesson_completion_given_empty_quick_queue_expect_done_home_destination_and_no_queue_claim', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(
        '*/lessons/42/complete',
        () => new HttpResponse(null, { status: 204 }),
      ),
      http.get('*/me/cards/due', () => HttpResponse.json([])),
    );
    const { onExit } = renderCompletion();

    await user.click(await screen.findByRole('button', { name: 'Done' }));

    expect(onExit).toHaveBeenCalledWith('home');
    expect(screen.queryByText(/review queue/)).not.toBeInTheDocument();
  });

  it('test_lesson_completion_given_back_to_lessons_click_expect_client_navigation_and_cached_queue_preserved', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(
        '*/lessons/42/complete',
        () => new HttpResponse(null, { status: 204 }),
      ),
      http.get('*/me/cards/due', () => HttpResponse.json([buildCard(1)])),
    );
    const { onExit, queryClient, router } = renderCompletion();

    await screen.findByRole('button', { name: 'Review 1 card' });
    await user.click(screen.getByRole('link', { name: 'Back to lessons' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/lesson');
    });
    expect(
      queryClient.getQueryData(reviewKeys.dueCards.byMode('quick')),
    ).toEqual([buildCard(1)]);
    expect(onExit).not.toHaveBeenCalled();
  });

  it('test_lesson_completion_given_pending_save_expect_disabled_action_and_no_queue_request_until_saved', async () => {
    let finishSave = () => {};
    const pendingSave = new Promise<void>((resolve) => {
      finishSave = resolve;
    });
    const loadQueue = vi.fn(() => HttpResponse.json([buildCard(1)]));
    server.use(
      http.post('*/lessons/42/complete', async () => {
        await pendingSave;
        return new HttpResponse(null, { status: 204 });
      }),
      http.get('*/me/cards/due', loadQueue),
    );
    renderCompletion();

    expect(
      await screen.findByRole('button', { name: 'Saving lesson…' }),
    ).toBeDisabled();
    expect(loadQueue).not.toHaveBeenCalled();
    finishSave();

    expect(
      await screen.findByRole('button', { name: 'Review 1 card' }),
    ).toBeEnabled();
  });

  it('test_lesson_completion_given_save_failure_expect_retry_before_loading_queue', async () => {
    const user = userEvent.setup();
    let saveAttempts = 0;
    const loadQueue = vi.fn(() => HttpResponse.json([buildCard(1)]));
    server.use(
      http.post('*/lessons/42/complete', () => {
        saveAttempts += 1;
        return new HttpResponse(null, {
          status: saveAttempts === 1 ? 500 : 204,
        });
      }),
      http.get('*/me/cards/due', loadQueue),
    );
    const { onExit } = renderCompletion();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not save lesson completion.',
    );
    expect(loadQueue).not.toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(
      await screen.findByRole('button', { name: 'Review 1 card' }),
    ).toBeEnabled();
    expect(saveAttempts).toBe(2);
  });

  it('test_lesson_completion_given_queue_failure_expect_retry_without_empty_queue_claim', async () => {
    const user = userEvent.setup();
    let queueAttempts = 0;
    server.use(
      http.post(
        '*/lessons/42/complete',
        () => new HttpResponse(null, { status: 204 }),
      ),
      http.get('*/me/cards/due', () => {
        queueAttempts += 1;
        return queueAttempts === 1
          ? new HttpResponse(null, { status: 500 })
          : HttpResponse.json([]);
      }),
    );
    const { onExit } = renderCompletion();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load your review queue.',
    );
    expect(
      screen.queryByRole('button', { name: 'Done' }),
    ).not.toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('button', { name: 'Done' })).toBeEnabled();
    expect(queueAttempts).toBe(2);
  });

  it('test_lesson_completion_given_cached_queue_retry_pending_expect_disabled_loading_action', async () => {
    const user = userEvent.setup();
    const queryClient = createQueryClient();
    queryClient.setQueryData(reviewKeys.dueCards.byMode('quick'), [
      buildCard(2),
    ]);
    let finishQueue = () => {};
    const pendingQueue = new Promise<void>((resolve) => {
      finishQueue = resolve;
    });
    let queueAttempts = 0;
    server.use(
      http.post(
        '*/lessons/42/complete',
        () => new HttpResponse(null, { status: 204 }),
      ),
      http.get('*/me/cards/due', async () => {
        queueAttempts += 1;
        if (queueAttempts === 1) {
          return new HttpResponse(null, { status: 500 });
        }
        await pendingQueue;
        return HttpResponse.json([buildCard(1)]);
      }),
    );
    const { onExit } = renderCompletion(queryClient);

    await user.click(await screen.findByRole('button', { name: 'Try again' }));

    try {
      expect(
        await screen.findByRole('button', { name: 'Loading review…' }),
      ).toBeDisabled();
      expect(onExit).not.toHaveBeenCalled();
    } finally {
      finishQueue();
    }
    expect(
      await screen.findByRole('button', { name: 'Review 1 card' }),
    ).toBeEnabled();
  });

  it('test_lesson_completion_given_cached_queue_expect_refreshed_count_and_invalidated_summaries', async () => {
    const user = userEvent.setup();
    const queryClient = createQueryClient();
    queryClient.setQueryDefaults(reviewKeys.dueCards.all, {
      staleTime: Infinity,
    });
    queryClient.setQueryData(reviewKeys.dueCards.byMode('quick'), [
      buildCard(1),
      buildCard(2),
    ]);
    queryClient.setQueryData(reviewKeys.dueCards.byMode('full'), [
      buildCard(1),
    ]);
    queryClient.setQueryData(dashboardKeys.stats, {});
    let finishQueue = () => {};
    const pendingQueue = new Promise<void>((resolve) => {
      finishQueue = resolve;
    });
    server.use(
      http.post(
        '*/lessons/42/complete',
        () => new HttpResponse(null, { status: 204 }),
      ),
      http.get('*/me/cards/due', async () => {
        await pendingQueue;
        return HttpResponse.json([buildCard(3)]);
      }),
    );
    renderCompletion(queryClient);

    expect(
      await screen.findByRole('button', { name: 'Loading review…' }),
    ).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Review 2 cards' }),
    ).not.toBeInTheDocument();
    finishQueue();

    await user.click(
      await screen.findByRole('button', { name: 'Review 1 card' }),
    );
    await waitFor(() => {
      expect(
        queryClient.getQueryState(reviewKeys.dueCards.byMode('full'))
          ?.isInvalidated,
      ).toBe(true);
      expect(
        queryClient.getQueryState(dashboardKeys.stats)?.isInvalidated,
      ).toBe(true);
    });
  });

  it('test_lesson_completion_given_offline_refresh_and_cached_queue_expect_disabled_action_until_fresh_count', async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(reviewKeys.dueCards.byMode('quick'), [
      buildCard(1),
      buildCard(2),
    ]);
    server.use(
      http.post('*/lessons/42/complete', () => {
        onlineManager.setOnline(false);
        return new HttpResponse(null, { status: 204 });
      }),
      http.get('*/me/cards/due', () => HttpResponse.json([buildCard(3)])),
    );
    renderCompletion(queryClient);

    try {
      expect(
        await screen.findByRole('button', { name: 'Loading review…' }),
      ).toBeDisabled();
      expect(
        screen.queryByRole('button', { name: 'Review 2 cards' }),
      ).not.toBeInTheDocument();
    } finally {
      onlineManager.setOnline(true);
    }

    expect(
      await screen.findByRole('button', { name: 'Review 1 card' }),
    ).toBeEnabled();
  });
});
