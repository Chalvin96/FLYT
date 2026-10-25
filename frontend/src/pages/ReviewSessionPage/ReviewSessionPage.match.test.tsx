import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw/http';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useReviewSession } from '@/hooks/review/useReviewSession';
import { MockLink } from '@/test/mockLink';
import { server } from '@/test/msw/server';
import type { ReviewResult, UserCard } from '@/types/api';
import { LESSON_PACKET_SCHEMA_VERSION } from '@/types/lesson-contracts';

import { ReviewSessionPage } from './ReviewSessionPage';

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router',
  );
  return { ...actual, Link: MockLink, useNavigate: () => vi.fn() };
});

const matchCard: UserCard = {
  id: 596,
  user_id: 1,
  pool_id: 596,
  due_at: '2026-01-01T00:00:00Z',
  fsrs_difficulty: null,
  fsrs_stability: null,
  fsrs_step: null,
  review_version: 0,
  last_review_at: null,
  state: 'review',
  card: {
    id: 1596,
    deck_id: 1,
    schema_version: LESSON_PACKET_SCHEMA_VERSION,
    type: 'match_pairs',
    payload: {
      kind: 'exercise',
      objective_id: 'match-objective',
      id: 'match-attempt',
      operation: 'match_pairs',
      prompt: [{ kind: 'text', value: 'Match the phrases.' }],
      explanation: null,
      payload: {
        left: [
          { left_id: 'l1', text: 'jeg leser' },
          { left_id: 'l2', text: 'hun skriver' },
        ],
        right: [
          { right_id: 'r1', text: 'I read' },
          { right_id: 'r2', text: 'she writes' },
        ],
        pairs: [
          { left_id: 'l1', right_id: 'r1' },
          { left_id: 'l2', right_id: 'r2' },
        ],
      },
    },
  },
};

function ReviewSession() {
  const session = useReviewSession('full');
  return <ReviewSessionPage session={session} />;
}

function mockMatchReviewSubmission() {
  let submittedReview: unknown;
  server.use(
    http.get('*/me/cards/due', () =>
      HttpResponse.json(submittedReview ? [] : [matchCard]),
    ),
    http.post('*/me/cards/596/review', async ({ request }) => {
      submittedReview = await request.json();
      return HttpResponse.json({
        card_state: 'review',
        due_at: '2027-01-01T00:00:00Z',
        new_remaining: 0,
        learning_remaining: 0,
        review_remaining: 0,
        review_version: 1,
      } satisfies ReviewResult);
    }),
  );
  return () => submittedReview;
}

async function openReviewSession() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ReviewSession />
    </QueryClientProvider>,
  );
  await screen.findByRole('button', { name: /^jeg leser$/i });
  return userEvent.setup();
}

async function matchEveryPair(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^jeg leser$/i }));
  await user.click(screen.getByRole('button', { name: /^I read$/i }));
  await user.click(screen.getByRole('button', { name: /^hun skriver$/i }));
  await user.click(screen.getByRole('button', { name: /^she writes$/i }));
}

describe('review Match accuracy', () => {
  it('test_match_given_wrong_tap_then_completed_board_expect_again_submission_and_zero_accuracy', async () => {
    const getSubmittedReview = mockMatchReviewSubmission();
    const user = await openReviewSession();

    await user.click(screen.getByRole('button', { name: /^jeg leser$/i }));
    await user.click(screen.getByRole('button', { name: /^she writes$/i }));

    expect(screen.queryByText(/^(correct|not quite)$/i)).toBeNull();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /^jeg leser$/i }),
      ).not.toBeDisabled(),
    );

    await matchEveryPair(user);

    expect(screen.getByText(/^not quite$/i)).toBeInTheDocument();
    const continueButton = screen.getByRole('button', { name: /continue/i });
    expect(continueButton).toBeEnabled();
    await user.click(continueButton);

    expect(await screen.findByText("You're all caught up")).toBeInTheDocument();
    expect(
      screen.getByText('1 card reviewed · 0% accuracy'),
    ).toBeInTheDocument();
    expect(getSubmittedReview()).toMatchObject({
      outcome: 'graded',
      rating: 1,
      card_id: matchCard.card.id,
      review_version: matchCard.review_version,
    });
  });

  it('test_match_given_completed_board_without_wrong_taps_expect_easy_submission_and_full_accuracy', async () => {
    const getSubmittedReview = mockMatchReviewSubmission();
    const user = await openReviewSession();

    await matchEveryPair(user);

    expect(screen.getByText(/^correct$/i)).toBeInTheDocument();
    const continueButton = screen.getByRole('button', { name: /continue/i });
    expect(continueButton).toBeEnabled();
    await user.click(continueButton);

    expect(await screen.findByText("You're all caught up")).toBeInTheDocument();
    expect(
      screen.getByText('1 card reviewed · 100% accuracy'),
    ).toBeInTheDocument();
    expect(getSubmittedReview()).toMatchObject({
      outcome: 'graded',
      rating: 4,
      card_id: matchCard.card.id,
      review_version: matchCard.review_version,
    });
  });
});
