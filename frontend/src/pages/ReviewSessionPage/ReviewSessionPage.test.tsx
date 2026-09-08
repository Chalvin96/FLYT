import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { QueueCounts } from '@/lib/sessionQueue';
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
    useNavigate: () => mockNavigate,
  };
});

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

const EMPTY_COUNTS: QueueCounts = { new: 0, learning: 0, review: 0 };

const ACCEPTED = vi.fn().mockResolvedValue({ accepted: true });

function makeDefinitionCard(id: number, word: string): UserCard {
  return {
    id,
    user_id: 1,
    pool_id: id,
    due_at: '2026-03-14T09:00:00Z',
    fsrs_difficulty: null,
    fsrs_stability: null,
    fsrs_step: null,
    last_review_at: null,
    state: 'review',
    card: {
      id,
      deck_id: 1,
      type: 'definition',
      payload: {
        word,
        pos: 'noun',
        primary_translation: `${word} translation`,
        definitions: [
          {
            uuid: `def-${word}-1`,
            definition: `${word} definition`,
            translation: `${word} translation`,
            examples_json: [],
          },
        ],
      },
    },
  };
}

function makeSchemaChooseCard(id: number): UserCard {
  return {
    id,
    user_id: 1,
    pool_id: id,
    due_at: '2026-03-14T09:00:00Z',
    fsrs_difficulty: null,
    fsrs_stability: null,
    fsrs_step: null,
    last_review_at: null,
    state: 'review',
    card: {
      id,
      deck_id: 1,
      schema_version: LESSON_PACKET_SCHEMA_VERSION,
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

function makeWriteCard(id: number): UserCard {
  return {
    id,
    user_id: 1,
    pool_id: id,
    lesson_id: 42,
    due_at: '2026-03-14T09:00:00Z',
    fsrs_difficulty: null,
    fsrs_stability: null,
    fsrs_step: null,
    last_review_at: null,
    state: 'review',
    card: {
      id,
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
          criteria: [
            {
              id: 'criterion-1',
              instruction: 'Writes a Norwegian sentence.',
            },
          ],
        },
      },
    },
  };
}

async function answerCurrentCard(buttonLabel: RegExp) {
  await userEvent.click(
    await screen.findByRole('button', { name: /^(show|check) answer$/i }),
  );
  await userEvent.click(screen.getByRole('button', { name: buttonLabel }));
}

describe('ReviewSessionPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    vi.mocked(toast.error).mockClear();
    ACCEPTED.mockClear();
    ACCEPTED.mockResolvedValue({ accepted: true });
    globalThis.localStorage.clear();
  });

  it('renders the current card', async () => {
    render(
      <ReviewSessionPage
        currentCard={makeDefinitionCard(1, 'hund')}
        status="card"
        counts={{ new: 1, learning: 0, review: 0 }}
        submitReview={ACCEPTED}
      />,
    );

    expect((await screen.findAllByText('hund')).length).toBeGreaterThan(0);
  });

  it('test_review_page_given_initial_issuance_failure_expect_retry_without_completion', async () => {
    const onRetry = vi.fn().mockResolvedValue(undefined);
    render(
      <ReviewSessionPage
        currentCard={undefined}
        status="error"
        counts={EMPTY_COUNTS}
        isError
        error={new Error('Could not reach the review queue.')}
        onRetry={onRetry}
        submitReview={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not start review',
    );
    expect(screen.queryByText('Session complete')).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders the remaining counts counter with data-testids', () => {
    render(
      <ReviewSessionPage
        currentCard={makeDefinitionCard(1, 'hund')}
        status="card"
        counts={{ new: 3, learning: 2, review: 1 }}
        submitReview={ACCEPTED}
      />,
    );

    expect(screen.getByTestId('count-new')).toHaveTextContent('3 new');
    expect(screen.getByTestId('count-learning')).toHaveTextContent(
      '2 learning',
    );
    expect(screen.getByTestId('count-review')).toHaveTextContent('1 review');
  });

  it('test_review_session_given_answered_card_expect_submits_graded_outcome', async () => {
    render(
      <ReviewSessionPage
        currentCard={makeDefinitionCard(1, 'hund')}
        status="card"
        counts={{ new: 1, learning: 0, review: 0 }}
        submitReview={ACCEPTED}
      />,
    );

    await answerCurrentCard(/good/i);

    await waitFor(() => {
      expect(ACCEPTED).toHaveBeenCalledWith({
        submission: { outcome: 'graded', rating: 3 },
      });
    });
  });

  it('test_review_session_given_write_card_expect_uses_lesson_judge', async () => {
    const judgeWrite = vi.fn().mockResolvedValue({
      criteria: [{ criterion_id: 'c1', met: true, evidence: 'Jeg' }],
    });
    const user = userEvent.setup();
    render(
      <ReviewSessionPage
        currentCard={makeWriteCard(42)}
        status="card"
        counts={{ new: 1, learning: 0, review: 0 }}
        judgeWrite={judgeWrite}
        submitReview={ACCEPTED}
      />,
    );

    await user.type(screen.getByRole('textbox'), 'Jeg skriver nå.');
    await user.click(screen.getByRole('button', { name: /^check$/i }));

    await waitFor(() => {
      expect(judgeWrite).toHaveBeenCalledWith('Jeg skriver nå.');
    });
  });

  it('shows completion screen when status is done', () => {
    render(
      <ReviewSessionPage
        currentCard={undefined}
        status="done"
        counts={EMPTY_COUNTS}
        submitReview={vi.fn()}
      />,
    );

    expect(screen.getByText('Session complete')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /back to review/i }),
    ).toBeInTheDocument();
  });

  it('renders the "More cards due later today" hint when done with learning cards remaining', () => {
    render(
      <ReviewSessionPage
        currentCard={undefined}
        status="done"
        counts={{ new: 0, learning: 2, review: 0 }}
        submitReview={vi.fn()}
      />,
    );

    expect(screen.getByText('Session complete')).toBeInTheDocument();
    expect(screen.getByText(/more cards due later today/i)).toBeInTheDocument();
  });

  it('omits the "More cards due later today" hint when done with no learning cards', () => {
    render(
      <ReviewSessionPage
        currentCard={undefined}
        status="done"
        counts={EMPTY_COUNTS}
        submitReview={vi.fn()}
      />,
    );

    expect(
      screen.queryByText(/more cards due later today/i),
    ).not.toBeInTheDocument();
  });

  it('navigates to review page when clicking back to review', async () => {
    render(
      <ReviewSessionPage
        currentCard={undefined}
        status="done"
        counts={EMPTY_COUNTS}
        submitReview={vi.fn()}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /back to review/i }),
    );

    expect(mockNavigate).toHaveBeenCalledWith({
      search: { mode: 'full' },
      to: '/review',
    });
  });

  it('redirects to review page when done with no reviewed cards', async () => {
    render(
      <ReviewSessionPage
        currentCard={undefined}
        status="done"
        counts={EMPTY_COUNTS}
        isLoading={false}
        submitReview={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        replace: true,
        search: { mode: 'full' },
        to: '/review',
      });
    });
  });

  it('does NOT redirect when done with no reviews but learning cards remain due later today', async () => {
    // showNext reports `done` with reviewedCount===0 when only
    // learning/relearning cards remain beyond the learn-ahead window. The
    // queue is not empty, so redirecting would bounce back here in a loop
    // (Start practice stays enabled while those cards sit in /due). The
    // completion screen with the "More cards due later today." hint handles
    // this case instead.
    render(
      <ReviewSessionPage
        currentCard={undefined}
        status="done"
        counts={{ new: 0, learning: 2, review: 0 }}
        isLoading={false}
        submitReview={vi.fn()}
      />,
    );

    expect(screen.getByText('Session complete')).toBeInTheDocument();
    expect(screen.getByText(/more cards due later today/i)).toBeInTheDocument();

    // Give the redirect effect a chance to run (it must not).
    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it('shows backend code and message when review submission fails', async () => {
    render(
      <ReviewSessionPage
        currentCard={makeDefinitionCard(1, 'hund')}
        status="card"
        counts={{ new: 1, learning: 0, review: 0 }}
        submitReview={vi.fn().mockRejectedValue({
          isAxiosError: true,
          message: 'Request failed',
          response: {
            data: {
              detail: {
                code: 'INVALID_REVIEW_RATING',
                message: 'Pick a valid rating.',
              },
            },
          },
        })}
      />,
    );

    await answerCurrentCard(/good/i);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'INVALID_REVIEW_RATING - Pick a valid rating.',
      );
    });
    expect(screen.queryByText('Session complete')).not.toBeInTheDocument();
  });

  it('reveals schema exercise feedback before submitting the review result', async () => {
    render(
      <ReviewSessionPage
        currentCard={makeSchemaChooseCard(1)}
        status="card"
        counts={{ new: 1, learning: 0, review: 0 }}
        submitReview={ACCEPTED}
      />,
    );

    await userEvent.click(screen.getByRole('radio', { name: /snakker/i }));
    await userEvent.click(screen.getByRole('button', { name: /check/i }));

    expect(ACCEPTED).not.toHaveBeenCalled();
    expect(screen.getByText('Correct')).toBeInTheDocument();
    expect(screen.getByText('This is the correct option.')).toBeInTheDocument();
    expect(screen.getByText('Matches the subject.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(ACCEPTED).toHaveBeenCalledWith({
        submission: { outcome: 'graded', rating: 4 },
      });
    });
  });

  it('test_write_review_given_judge_expect_judges_before_review_submission', async () => {
    const user = userEvent.setup();
    const judgeWrite = vi.fn().mockResolvedValue({
      criteria: [
        {
          criterion_id: 'criterion-1',
          met: true,
          evidence: 'Jeg lærer norsk.',
        },
      ],
    });

    render(
      <ReviewSessionPage
        currentCard={makeWriteCard(1)}
        status="card"
        counts={{ new: 1, learning: 0, review: 0 }}
        judgeWrite={judgeWrite}
        submitReview={ACCEPTED}
      />,
    );

    await user.type(
      screen.getByRole('textbox', { name: /your response in norwegian/i }),
      'Jeg lærer norsk.',
    );
    await user.click(screen.getByRole('button', { name: /^check$/i }));

    await waitFor(() => {
      expect(judgeWrite).toHaveBeenCalledWith('Jeg lærer norsk.');
    });
    expect(ACCEPTED).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() => {
      expect(ACCEPTED).toHaveBeenCalledWith({
        submission: { outcome: 'graded', rating: 4 },
      });
    });
  });

  it('test_write_draft_given_review_rejected_expect_preserved', async () => {
    const user = userEvent.setup();
    const submitReview = vi.fn().mockResolvedValue({ accepted: false });
    const draftKey = 'flyt.write.draft.1-card-1.review-write';

    render(
      <ReviewSessionPage
        currentCard={makeWriteCard(1)}
        status="card"
        counts={{ new: 1, learning: 0, review: 0 }}
        submitReview={submitReview}
      />,
    );

    await user.type(
      screen.getByRole('textbox', { name: /your response in norwegian/i }),
      'Jeg lærer norsk.',
    );
    await user.click(screen.getByRole('button', { name: /skip for now/i }));

    await waitFor(() => {
      expect(submitReview).toHaveBeenCalledWith({
        submission: { outcome: 'skipped' },
      });
    });
    expect(globalThis.localStorage.getItem(draftKey)).toBe('Jeg lærer norsk.');
  });

  it('test_ungraded_review_given_completion_expect_accuracy_excludes_card', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ReviewSessionPage
        currentCard={makeWriteCard(1)}
        status="card"
        counts={{ new: 1, learning: 0, review: 0 }}
        submitReview={ACCEPTED}
      />,
    );

    await user.click(screen.getByRole('button', { name: /skip for now/i }));

    await waitFor(() => {
      expect(ACCEPTED).toHaveBeenCalledWith({
        submission: { outcome: 'skipped' },
      });
    });

    rerender(
      <ReviewSessionPage
        currentCard={undefined}
        status="done"
        counts={EMPTY_COUNTS}
        submitReview={ACCEPTED}
      />,
    );

    expect(await screen.findByText('Session complete')).toBeInTheDocument();
    expect(screen.getByText('1 card reviewed')).toBeInTheDocument();
    expect(screen.getByText('No graded answers')).toBeInTheDocument();
    expect(screen.queryByText('0% accuracy')).not.toBeInTheDocument();
  });

  it('renders the static "Studying ahead" badge when currentCardAhead is true', () => {
    render(
      <ReviewSessionPage
        currentCard={makeDefinitionCard(1, 'hund')}
        status="card"
        counts={{ new: 0, learning: 1, review: 0 }}
        currentCardAhead={true}
        submitReview={vi.fn()}
      />,
    );

    const signal = screen.getByTestId('ahead-signal');
    expect(signal).toHaveTextContent(/studying ahead/i);
    // Static badge — no countdown / "due in" text.
    expect(signal).not.toHaveTextContent(/due in/i);
  });

  it('omits the "Studying ahead" signal when currentCardAhead is false', () => {
    render(
      <ReviewSessionPage
        currentCard={makeDefinitionCard(1, 'hund')}
        status="card"
        counts={{ new: 0, learning: 1, review: 0 }}
        currentCardAhead={false}
        submitReview={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('ahead-signal')).not.toBeInTheDocument();
  });

  it('re-show of the same card id with incremented presentationSeq resets the card to the front (Check answer visible)', () => {
    const card = makeDefinitionCard(1, 'hund');

    const { rerender } = render(
      <ReviewSessionPage
        currentCard={card}
        status="card"
        counts={{ new: 0, learning: 1, review: 0 }}
        presentationSeq={0}
        submitReview={ACCEPTED}
      />,
    );

    // Flip the card to reveal rating buttons on the back.
    expect(
      screen.getByRole('button', { name: /check answer/i }),
    ).toBeInTheDocument();

    // Simulate the hook bumping presentationSeq after an accepted review, then
    // the same card id being re-shown via learn-ahead. The remounted card
    // must present the front (Check answer) again, not the rating buttons.
    rerender(
      <ReviewSessionPage
        currentCard={card}
        status="card"
        counts={{ new: 0, learning: 1, review: 0 }}
        presentationSeq={1}
        submitReview={ACCEPTED}
      />,
    );

    // Front side is shown again after remount.
    expect(
      screen.getByRole('button', { name: /check answer/i }),
    ).toBeInTheDocument();
    // Rating buttons (back side) must not be visible before flipping.
    expect(
      screen.queryByRole('button', { name: 'Again' }),
    ).not.toBeInTheDocument();
  });

  it('tracks reviewed count and accuracy across multiple reviews then shows completion', async () => {
    // Drive the page through two reviews by switching currentCard and then
    // transitioning to done. The parent (hook) owns the queue; the page only
    // tracks reviewed/correct counts locally.
    const { rerender } = render(
      <ReviewSessionPage
        currentCard={makeDefinitionCard(1, 'hund')}
        status="card"
        counts={{ new: 2, learning: 0, review: 0 }}
        submitReview={ACCEPTED}
      />,
    );

    await answerCurrentCard(/good/i);
    await waitFor(() =>
      expect(ACCEPTED).toHaveBeenCalledWith({
        submission: { outcome: 'graded', rating: 3 },
      }),
    );

    rerender(
      <ReviewSessionPage
        currentCard={makeDefinitionCard(2, 'katt')}
        status="card"
        counts={{ new: 1, learning: 0, review: 0 }}
        submitReview={ACCEPTED}
      />,
    );

    await answerCurrentCard(/easy/i);
    await waitFor(() =>
      expect(ACCEPTED).toHaveBeenCalledWith({
        submission: { outcome: 'graded', rating: 4 },
      }),
    );

    rerender(
      <ReviewSessionPage
        currentCard={undefined}
        status="done"
        counts={EMPTY_COUNTS}
        submitReview={ACCEPTED}
      />,
    );

    expect(await screen.findByText('Session complete')).toBeInTheDocument();
    expect(screen.getByText('2 cards reviewed')).toBeInTheDocument();
    expect(screen.getByText('100% accuracy')).toBeInTheDocument();
  });

  it('uses singular card label for a single completed card', async () => {
    const { rerender } = render(
      <ReviewSessionPage
        currentCard={makeDefinitionCard(1, 'hund')}
        status="card"
        counts={{ new: 1, learning: 0, review: 0 }}
        submitReview={ACCEPTED}
      />,
    );

    await answerCurrentCard(/good/i);
    await waitFor(() =>
      expect(ACCEPTED).toHaveBeenCalledWith({
        submission: { outcome: 'graded', rating: 3 },
      }),
    );

    rerender(
      <ReviewSessionPage
        currentCard={undefined}
        status="done"
        counts={EMPTY_COUNTS}
        submitReview={ACCEPTED}
      />,
    );

    expect(await screen.findByText('1 card reviewed')).toBeInTheDocument();
    expect(screen.queryByText('1 cards reviewed')).not.toBeInTheDocument();
  });
});
