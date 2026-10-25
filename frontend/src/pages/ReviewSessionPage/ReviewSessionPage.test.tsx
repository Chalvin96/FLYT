import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { ReviewSessionState } from '@/hooks/review/useReviewSession';
import { server } from '@/test/msw/server';
import type { UserCard } from '@/types/api';
import { LESSON_PACKET_SCHEMA_VERSION } from '@/types/lesson-contracts';

import { ReviewSessionPage } from './ReviewSessionPage';

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router',
  );
  return {
    ...actual,
    Navigate: (props: unknown) => {
      mockNavigate(props);
      return null;
    },
    useNavigate: () => mockNavigate,
  };
});

function definitionCard(id: number): UserCard {
  return {
    id,
    user_id: 1,
    pool_id: id,
    due_at: '2026-03-14T09:00:00Z',
    fsrs_difficulty: null,
    fsrs_stability: null,
    fsrs_step: null,
    review_version: 0,
    last_review_at: null,
    state: 'review',
    card: {
      id,
      deck_id: 1,
      type: 'definition',
      payload: {
        word: 'hund',
        pos: 'noun',
        primary_translation: 'dog',
        definitions: [
          {
            uuid: 'def-hund-1',
            definition: 'hund definition',
            translation: 'dog',
            examples_json: [],
          },
        ],
      },
    },
  };
}

function chooseCard(
  schemaVersion: string = LESSON_PACKET_SCHEMA_VERSION,
): UserCard {
  return {
    id: 2,
    user_id: 1,
    pool_id: 2,
    due_at: '2026-03-14T09:00:00Z',
    fsrs_difficulty: null,
    fsrs_stability: null,
    fsrs_step: null,
    review_version: 0,
    last_review_at: null,
    state: 'review',
    card: {
      id: 2,
      deck_id: 1,
      schema_version: schemaVersion,
      type: 'choose',
      payload: {
        kind: 'exercise',
        id: 'schema-choose',
        operation: 'choose',
        objective_id: 'obj-1',
        prompt: [{ kind: 'text', value: 'Velg riktig ord' }],
        explanation: [{ kind: 'text', value: 'This is the correct option.' }],
        payload: {
          options: [
            {
              option_id: 'opt-1',
              text: 'snakker',
              why: 'Matches the subject.',
            },
            { option_id: 'opt-2', text: 'snakket', why: 'This is past tense.' },
          ],
          answer_id: 'opt-1',
        },
      },
    },
  };
}

function writeCard(): UserCard {
  return {
    id: 3,
    user_id: 1,
    pool_id: 3,
    lesson_id: 42,
    due_at: '2026-03-14T09:00:00Z',
    fsrs_difficulty: null,
    fsrs_stability: null,
    fsrs_step: null,
    review_version: 0,
    last_review_at: null,
    state: 'review',
    card: {
      id: 3,
      deck_id: 1,
      schema_version: LESSON_PACKET_SCHEMA_VERSION,
      type: 'write',
      payload: {
        kind: 'exercise',
        id: 'review-write',
        operation: 'write',
        objective_id: 'obj-write',
        prompt: [{ kind: 'text', value: 'Write a Norwegian sentence.' }],
        explanation: null,
        payload: {
          response_language: 'no',
          min_words: 1,
          max_words: 10,
          judge_prompt: 'Judge the response.',
          criteria: [{ id: 'criterion-1', instruction: 'Writes a sentence.' }],
        },
      },
    },
  };
}

function cardSession(
  card: UserCard,
  overrides: Partial<Extract<ReviewSessionState, { kind: 'card' }>> = {},
): Extract<ReviewSessionState, { kind: 'card' }> {
  return {
    kind: 'card',
    card,
    presentationKey: `${card.id}-0`,
    ahead: false,
    counts: { new: 1, learning: 0, review: 0 },
    summary: { reviewedCount: 0, accuracy: null },
    isSubmitting: false,
    submitOutcome: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('ReviewSessionPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    globalThis.localStorage.clear();
  });

  it('test_review_page_given_initial_issuance_failure_expect_retry_without_completion', async () => {
    const retry = vi.fn().mockResolvedValue(undefined);
    render(
      <ReviewSessionPage
        session={{
          kind: 'error',
          message: 'Unavailable',
          isRetrying: false,
          retry,
        }}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not start review',
    );
    expect(screen.queryByText('Session complete')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('test_review_page_given_empty_issuance_expect_return_to_review', () => {
    render(<ReviewSessionPage session={{ kind: 'empty' }} />);
    expect(mockNavigate).toHaveBeenCalledWith({
      replace: true,
      search: { mode: 'full' },
      to: '/review',
    });
  });

  it('test_review_page_given_card_expect_counts_ahead_signal_and_outcome_pass_through', async () => {
    const session = cardSession(definitionCard(1), {
      ahead: true,
      counts: { new: 3, learning: 2, review: 1 },
    });
    const { rerender } = render(<ReviewSessionPage session={session} />);

    expect(screen.getByTestId('count-new')).toHaveTextContent('3 new');
    expect(screen.getByTestId('count-learning')).toHaveTextContent(
      '2 learning',
    );
    expect(screen.getByTestId('count-review')).toHaveTextContent('1 review');
    expect(screen.getByTestId('ahead-signal')).toHaveTextContent(
      'Studying ahead',
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Check answer' }),
    );
    await userEvent.click(screen.getByRole('button', { name: /good/i }));
    expect(session.submitOutcome).toHaveBeenCalledWith({
      kind: 'graded',
      correct: true,
      rating: 3,
    });
    rerender(<ReviewSessionPage session={{ ...session, ahead: false }} />);
    expect(screen.queryByTestId('ahead-signal')).not.toBeInTheDocument();
  });

  it('test_review_page_given_completion_expect_summary_and_refreshed_next_step', async () => {
    server.use(
      http.get('*/me/cards/due', () => HttpResponse.json([definitionCard(2)])),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <ReviewSessionPage
          session={{
            kind: 'complete',
            counts: { new: 0, learning: 1, review: 0 },
            summary: { reviewedCount: 2, accuracy: 50 },
          }}
        />
      </QueryClientProvider>,
    );

    expect(
      screen.getByText('2 cards reviewed · 50% accuracy'),
    ).toBeInTheDocument();
    expect(await screen.findByText('1 card due now')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Continue reviewing' }),
    );
    expect(mockNavigate).toHaveBeenCalledWith({
      search: { mode: 'full' },
      to: '/review/session',
      state: { reviewSessionId: expect.any(String) },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Back to Home' }));
    expect(mockNavigate).toHaveBeenLastCalledWith({ to: '/' });
  });

  it('test_review_page_given_choose_card_expect_feedback_before_outcome', async () => {
    const session = cardSession(chooseCard());
    render(<ReviewSessionPage session={session} />);

    await userEvent.click(screen.getByRole('radio', { name: /snakker/i }));
    await userEvent.click(screen.getByRole('button', { name: /check/i }));
    expect(session.submitOutcome).not.toHaveBeenCalled();
    expect(screen.getByText('Correct')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => {
      expect(session.submitOutcome).toHaveBeenCalledWith({
        kind: 'graded',
        correct: true,
        rating: 4,
      });
    });
  });

  it('test_review_page_given_unsupported_card_expect_ungraded_unsupported_only', async () => {
    const session = cardSession(chooseCard('unsupported'));
    render(<ReviewSessionPage session={session} />);

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(session.submitOutcome).toHaveBeenCalledOnce();
    expect(session.submitOutcome).toHaveBeenCalledWith({
      kind: 'ungraded',
      outcome: 'unsupported',
    });
  });

  it('test_review_page_given_write_card_expect_lesson_judge_before_outcome', async () => {
    const session = cardSession(writeCard());
    const judgeWrite = vi.fn();
    server.use(
      http.post(
        '*/lessons/42/exercises/review-write/judge-write',
        async ({ request }) => {
          judgeWrite(await request.json());
          return HttpResponse.json({
            criteria: [
              { criterion_id: 'criterion-1', met: true, evidence: 'Jeg' },
            ],
          });
        },
      ),
    );
    const user = userEvent.setup();
    render(<ReviewSessionPage session={session} />);

    await user.type(screen.getByRole('textbox'), 'Jeg lærer norsk.');
    await user.click(screen.getByRole('button', { name: /^check$/i }));
    await waitFor(() =>
      expect(judgeWrite).toHaveBeenCalledWith({ response: 'Jeg lærer norsk.' }),
    );
    expect(session.submitOutcome).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    await waitFor(() => expect(session.submitOutcome).toHaveBeenCalledOnce());
  });

  it('test_review_page_given_write_skip_rejected_expect_draft_preserved', async () => {
    const session = cardSession(writeCard(), {
      submitOutcome: vi.fn().mockResolvedValue(false),
    });
    const user = userEvent.setup();
    render(<ReviewSessionPage session={session} />);

    await user.type(screen.getByRole('textbox'), 'Jeg lærer norsk.');
    await user.click(screen.getByRole('button', { name: /skip for now/i }));
    await waitFor(() => {
      expect(session.submitOutcome).toHaveBeenCalledWith({
        kind: 'ungraded',
        outcome: 'skipped',
      });
    });
    expect(
      localStorage.getItem('flyt.write.draft.user-1-card-3.review-write'),
    ).toBe('Jeg lærer norsk.');
  });

  it('test_review_page_given_same_card_presented_again_expect_front_reset', async () => {
    const card = definitionCard(1);
    const { rerender } = render(
      <ReviewSessionPage session={cardSession(card)} />,
    );

    await userEvent.click(
      await screen.findByRole('button', { name: 'Check answer' }),
    );
    expect(screen.getByRole('button', { name: 'Again' })).toBeInTheDocument();

    rerender(
      <ReviewSessionPage
        session={cardSession(card, { presentationKey: '1-1' })}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Check answer' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Again' }),
    ).not.toBeInTheDocument();
  });
});
