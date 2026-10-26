import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as exerciseAttempt from '@/hooks/flashcard/useExerciseAttempt/useExerciseAttempt';

import { FlashCardBuild } from './FlashCardBuild';

function buildExercise(overrides?: {
  explanation?: Array<{ kind: 'text'; value: string }>;
}) {
  return {
    kind: 'exercise' as const,
    objective_id: 'obj-1',
    id: 'build-1',
    operation: 'build' as const,
    prompt: [{ kind: 'text' as const, value: 'Build the sentence' }],
    explanation: overrides?.explanation ?? null,
    payload: {
      tokens: [
        { token_id: 't1', text: 'Jeg', fixed: true },
        { token_id: 't2', text: 'spiser', fixed: false },
        { token_id: 't3', text: 'fisk', fixed: false },
        { token_id: 't4', text: 'i dag', fixed: true },
      ],
      answer_order: ['t1', 't2', 't3', 't4'],
    },
  };
}

describe('FlashCardBuild', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shuffles movable bank tokens when exported in answer order', () => {
    const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    render(
      <FlashCardBuild
        allowRetry
        exercise={{
          kind: 'exercise',
          objective_id: 'obj-1',
          id: 'build-shuffle',
          operation: 'build',
          prompt: [{ kind: 'text', value: 'Build the sentence' }],
          explanation: null,
          payload: {
            tokens: [
              { token_id: 't1', text: 'Jeg', fixed: true },
              { token_id: 't2', text: 'spiser', fixed: false },
              { token_id: 't3', text: 'fisk', fixed: false },
              { token_id: 't4', text: 'ofte', fixed: false },
            ],
            answer_order: ['t1', 't2', 't3', 't4'],
          },
        }}
      />,
    );

    const bankTokens = screen
      .getAllByRole('button', { name: /add/i })
      .map((button) => button.textContent);
    expect(bankTokens).toEqual(['spiser', 'ofte', 'fisk']);
    expect(bankTokens).not.toEqual(['spiser', 'fisk', 'ofte']);

    mockRandom.mockRestore();
  });

  it('preplaces fixed tokens and prevents duplicate insertion', async () => {
    render(<FlashCardBuild allowRetry exercise={buildExercise()} />);

    expect(screen.getByText('Jeg')).toBeInTheDocument();
    expect(screen.getByText('i dag')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /add jeg/i }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /add fisk/i }));
    expect(
      screen.queryByRole('button', { name: /add fisk/i }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /add spiser/i }));
    expect(
      screen.queryByRole('button', { name: /add spiser/i }),
    ).not.toBeInTheDocument();
  });

  it('returns a placed token to the bank when it is removed', async () => {
    render(<FlashCardBuild allowRetry exercise={buildExercise()} />);

    await userEvent.click(screen.getByRole('button', { name: /add spiser/i }));
    expect(
      screen.queryByRole('button', { name: /add spiser/i }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: /remove spiser/i }),
    );
    expect(
      screen.getByRole('button', { name: /add spiser/i }),
    ).toBeInTheDocument();
  });

  it('keeps the bank and answer token counts conserved while building', async () => {
    render(<FlashCardBuild allowRetry exercise={buildExercise()} />);

    await userEvent.click(screen.getByRole('button', { name: /add spiser/i }));
    await userEvent.click(screen.getByRole('button', { name: /add fisk/i }));

    expect(screen.getAllByTestId('token-chip')).toHaveLength(4);
    expect(
      screen.queryByRole('button', { name: /add spiser/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /add fisk/i }),
    ).not.toBeInTheDocument();
  });

  // --- Retry flow tests ---

  it('test_build_given_first_try_solve_expect_correct_outcome', async () => {
    const onFinished = vi.fn();
    const user = userEvent.setup();
    render(
      <FlashCardBuild
        allowRetry
        exercise={buildExercise()}
        onFinished={onFinished}
      />,
    );

    // Correct order: spiser, fisk.
    await user.click(screen.getByRole('button', { name: /add spiser/i }));
    await user.click(screen.getByRole('button', { name: /add fisk/i }));
    await user.click(screen.getByRole('button', { name: /check/i }));

    expect(screen.getByTestId('operation-banner')).toHaveTextContent(
      /^correct$/i,
    );

    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'graded', correct: true }),
    );
  });

  it('wrong check → alert present, no per-item colors, board editable', async () => {
    const user = userEvent.setup();
    render(<FlashCardBuild allowRetry exercise={buildExercise()} />);

    // Wrong order: fisk first, then spiser.
    await user.click(screen.getByRole('button', { name: /add fisk/i }));
    await user.click(screen.getByRole('button', { name: /add spiser/i }));
    await user.click(screen.getByRole('button', { name: /check/i }));

    // Alert message present (sr-only live region; visible banner has no role).
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveClass('sr-only');
    expect(alerts[0]).toHaveTextContent(
      /incorrect — adjust your answer and try again./i,
    );

    // No per-item colors: placed chips have idle state.
    const placedChips = screen
      .getAllByTestId('token-chip')
      .filter(
        (el) =>
          el.tagName === 'BUTTON' &&
          /remove/i.test(el.getAttribute('aria-label') ?? ''),
      );
    for (const chip of placedChips) {
      expect(chip).toHaveAttribute('data-state', 'idle');
    }

    // Board stays editable: chips NOT disabled.
    for (const chip of placedChips) {
      expect(chip).not.toBeDisabled();
    }
  });

  it('dirty gate: Check disabled after wrong check, re-enabled after board change', async () => {
    const user = userEvent.setup();
    render(<FlashCardBuild allowRetry exercise={buildExercise()} />);

    // Wrong order.
    await user.click(screen.getByRole('button', { name: /add fisk/i }));
    await user.click(screen.getByRole('button', { name: /add spiser/i }));
    await user.click(screen.getByRole('button', { name: /check/i }));

    // Check is disabled (dirty gate).
    expect(screen.getByRole('button', { name: /^check/i })).toBeDisabled();

    // Change the board: remove fisk (slot 0) → back to bank, then add it back.
    await user.click(screen.getByRole('button', { name: /remove fisk/i }));
    await user.click(screen.getByRole('button', { name: /add fisk/i }));

    // Check re-enabled (board changed + complete).
    expect(screen.getByRole('button', { name: /^check/i })).not.toBeDisabled();
  });

  it('test_build_given_retry_after_wrong_check_expect_correct_outcome', async () => {
    const onFinished = vi.fn();
    const user = userEvent.setup();
    render(
      <FlashCardBuild
        allowRetry
        exercise={buildExercise()}
        onFinished={onFinished}
      />,
    );

    // Wrong first.
    await user.click(screen.getByRole('button', { name: /add fisk/i }));
    await user.click(screen.getByRole('button', { name: /add spiser/i }));
    await user.click(screen.getByRole('button', { name: /check/i }));

    // Fix: remove both, place in correct order.
    await user.click(screen.getByRole('button', { name: /remove fisk/i }));
    await user.click(screen.getByRole('button', { name: /remove spiser/i }));
    await user.click(screen.getByRole('button', { name: /add spiser/i }));
    await user.click(screen.getByRole('button', { name: /add fisk/i }));

    await user.click(screen.getByRole('button', { name: /check/i }));
    expect(screen.getByTestId('operation-banner')).toHaveTextContent(
      /^correct$/i,
    );

    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'graded', correct: true }),
    );
  });

  it('reveal shows the correct arrangement and revealed banner', async () => {
    const user = userEvent.setup();
    render(<FlashCardBuild allowRetry exercise={buildExercise()} />);

    // Wrong order.
    await user.click(screen.getByRole('button', { name: /add fisk/i }));
    await user.click(screen.getByRole('button', { name: /add spiser/i }));
    await user.click(screen.getByRole('button', { name: /check/i }));

    await user.click(screen.getByRole('button', { name: /reveal answer/i }));

    // Revealed banner.
    expect(screen.getByText(/here's the answer\./i)).toBeInTheDocument();

    // The sentence now shows the correct order: spiser, fisk.
    const sentence = screen.getByLabelText('Built sentence');
    const placedChips = within(sentence).getAllByTestId('token-chip');
    // Fixed Jeg + spiser + fisk + fixed i dag = 4 chips.
    expect(placedChips.length).toBeGreaterThanOrEqual(4);
    // Verify "spiser" appears before "fisk" in the sentence.
    const sentenceText = sentence.textContent ?? '';
    expect(sentenceText.indexOf('spiser')).toBeLessThan(
      sentenceText.indexOf('fisk'),
    );
  });

  it('test_build_given_reveal_of_wrong_board_expect_incorrect_outcome', async () => {
    const onFinished = vi.fn();
    const user = userEvent.setup();
    render(
      <FlashCardBuild
        allowRetry
        exercise={buildExercise()}
        onFinished={onFinished}
      />,
    );

    // Completely wrong: fisk, spiser → 0/2 correct.
    await user.click(screen.getByRole('button', { name: /add fisk/i }));
    await user.click(screen.getByRole('button', { name: /add spiser/i }));
    await user.click(screen.getByRole('button', { name: /check/i }));
    await user.click(screen.getByRole('button', { name: /reveal answer/i }));
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'graded', correct: false }),
    );
  });

  it('test_build_given_reveal_of_partly_correct_board_expect_incorrect_outcome', async () => {
    const onFinished = vi.fn();
    const user = userEvent.setup();
    const useAttempt = exerciseAttempt.useExerciseAttempt;
    const reportReveal = vi.fn();
    vi.spyOn(exerciseAttempt, 'useExerciseAttempt').mockImplementation(
      (config) => {
        const attempt = useAttempt(config);
        return {
          ...attempt,
          reveal: (fraction: number) => {
            reportReveal(fraction);
            attempt.reveal(fraction);
          },
        };
      },
    );
    // Use a 4-movable-token exercise so 2/4 = 0.5.
    render(
      <FlashCardBuild
        allowRetry
        exercise={{
          kind: 'exercise',
          objective_id: 'obj-1',
          id: 'build-4',
          operation: 'build',
          prompt: [{ kind: 'text', value: 'Build the sentence' }],
          explanation: null,
          payload: {
            tokens: [
              { token_id: 't1', text: 'Jeg', fixed: true },
              { token_id: 't2', text: 'spiser', fixed: false },
              { token_id: 't3', text: 'ikke', fixed: false },
              { token_id: 't4', text: 'fisk', fixed: false },
              { token_id: 't5', text: 'i dag', fixed: false },
            ],
            answer_order: ['t1', 't2', 't3', 't4', 't5'],
          },
        }}
        onFinished={onFinished}
      />,
    );

    // Place 2 correct (spiser, ikke) and 2 wrong (i dag, fisk).
    // Correct: spiser(0), ikke(1), fisk(2), i dag(3).
    // Place: spiser, ikke, i dag, fisk → 2/4 correct.
    await user.click(screen.getByRole('button', { name: /add spiser/i }));
    await user.click(screen.getByRole('button', { name: /add ikke/i }));
    await user.click(screen.getByRole('button', { name: /add i dag/i }));
    await user.click(screen.getByRole('button', { name: /add fisk/i }));
    await user.click(screen.getByRole('button', { name: /check/i }));
    await user.click(screen.getByRole('button', { name: /reveal answer/i }));
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(reportReveal).toHaveBeenCalledWith(0.5);
    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'graded', correct: false }),
    );
  });

  it('disables chips after terminal phase (solved)', async () => {
    const user = userEvent.setup();
    render(<FlashCardBuild allowRetry exercise={buildExercise()} />);

    await user.click(screen.getByRole('button', { name: /add spiser/i }));
    await user.click(screen.getByRole('button', { name: /add fisk/i }));
    await user.click(screen.getByRole('button', { name: /check/i }));

    for (const chip of screen.getAllByTestId('token-chip')) {
      if (chip.tagName === 'BUTTON') {
        expect(chip).toBeDisabled();
      }
    }
  });
});

describe('FlashCardBuild retry and commit behavior', () => {
  it('test_build_given_wrong_check_in_review_expect_completion_without_reveal', async () => {
    const onFinished = vi.fn();
    const user = userEvent.setup();
    render(
      <FlashCardBuild
        allowRetry={false}
        exercise={buildExercise()}
        onFinished={onFinished}
      />,
    );

    // Wrong order.
    await user.click(screen.getByRole('button', { name: /add fisk/i }));
    await user.click(screen.getByRole('button', { name: /add spiser/i }));
    await user.click(screen.getByRole('button', { name: /check/i }));

    // Terminal: no Reveal button, no Check button (Continue is the only
    // footer action).
    expect(
      screen.queryByRole('button', { name: /reveal answer/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /check/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /continue/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'graded', correct: false }),
    );
  });

  it('test_build_given_right_check_in_review_expect_correct_outcome', async () => {
    const onFinished = vi.fn();
    const user = userEvent.setup();
    render(
      <FlashCardBuild
        allowRetry={false}
        exercise={buildExercise()}
        onFinished={onFinished}
      />,
    );

    await user.click(screen.getByRole('button', { name: /add spiser/i }));
    await user.click(screen.getByRole('button', { name: /add fisk/i }));
    await user.click(screen.getByRole('button', { name: /check/i }));

    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'graded', correct: true }),
    );
  });

  it('allowRetry={true} (lesson): wrong check shows Reveal and allows retry', async () => {
    const user = userEvent.setup();
    render(<FlashCardBuild allowRetry exercise={buildExercise()} />);

    // Wrong order.
    await user.click(screen.getByRole('button', { name: /add fisk/i }));
    await user.click(screen.getByRole('button', { name: /add spiser/i }));
    await user.click(screen.getByRole('button', { name: /check/i }));

    // Wrong phase: Reveal appears, Check is disabled (dirty gate).
    expect(
      screen.getByRole('button', { name: /reveal answer/i }),
    ).toBeInTheDocument();
    const checkButton = screen.getByRole('button', { name: /^check/i });
    expect(checkButton).toBeDisabled();

    // Fix the board to re-enable Check.
    await user.click(screen.getByRole('button', { name: /remove fisk/i }));
    await user.click(screen.getByRole('button', { name: /remove spiser/i }));
    await user.click(screen.getByRole('button', { name: /add spiser/i }));
    await user.click(screen.getByRole('button', { name: /add fisk/i }));
    expect(screen.getByRole('button', { name: /^check/i })).not.toBeDisabled();
  });
});
