import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FlashCardJudge } from './FlashCardJudge';

const exercise = {
  kind: 'exercise' as const,
  objective_id: 'obj-1',
  id: 'judge-1',
  operation: 'judge' as const,
  prompt: [{ kind: 'text' as const, value: 'Judge the sentence.' }],
  explanation: null,
  payload: {
    sentence: [{ kind: 'text' as const, value: 'Jeg går til skolen.' }],
    is_correct: false,
    feedback: 'Use ikke after the finite verb in this sentence.',
  },
};

const SENTENCE = 'Jeg går til skolen.';

function getStimulusSurface() {
  return screen.getByTestId('judge-stimulus');
}

describe('FlashCardJudge', () => {
  it('renders the verdict choices as a radiogroup', () => {
    render(<FlashCardJudge exercise={exercise} />);

    const correctChoice = screen.getByRole('radio', {
      name: /the sentence is correct/i,
    });
    const errorChoice = screen.getByRole('radio', {
      name: /it has an error/i,
    });

    expect(correctChoice).toBeInTheDocument();
    expect(errorChoice).toBeInTheDocument();
    expect(correctChoice).toHaveAttribute('aria-checked', 'false');
    expect(errorChoice).toHaveAttribute('aria-checked', 'false');
    expect(
      screen.getByRole('radiogroup', { name: /grammatically correct/i }),
    ).toBeInTheDocument();
  });

  it('supports arrow-key roving selection across the radiogroup', async () => {
    const user = userEvent.setup();
    render(<FlashCardJudge exercise={exercise} />);

    const correctChoice = screen.getByRole('radio', {
      name: /the sentence is correct/i,
    });
    correctChoice.focus();
    await user.keyboard('{ArrowDown}');

    const errorChoice = screen.getByRole('radio', {
      name: /it has an error/i,
    });
    expect(errorChoice).toHaveAttribute('aria-checked', 'true');
    expect(errorChoice).toHaveFocus();
  });

  it('scores a correct judgment, reports onFinished, and disables after check', async () => {
    const onFinished = vi.fn();
    const user = userEvent.setup();

    render(<FlashCardJudge exercise={exercise} onFinished={onFinished} />);

    await user.click(screen.getByRole('radio', { name: /it has an error/i }));
    await user.click(screen.getByRole('button', { name: /check/i }));

    expect(screen.getByRole('status')).toHaveTextContent(/^correct$/i);
    expect(screen.getByText(/correction/i)).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: /it has an error/i }),
    ).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledWith({
      kind: 'graded',
      correct: true,
      rating: 4,
    });
  });

  it('scores a wrong judgment and reports incorrect results', async () => {
    const onFinished = vi.fn();
    const user = userEvent.setup();

    render(<FlashCardJudge exercise={exercise} onFinished={onFinished} />);

    const wrongPick = screen.getByRole('radio', {
      name: /the sentence is correct/i,
    });
    await user.click(wrongPick);
    await user.click(screen.getByRole('button', { name: /check/i }));

    expect(screen.getByText(/not quite/i)).toBeInTheDocument();
    expect(screen.getAllByText(/use ikke after the finite verb/i)).toHaveLength(
      1,
    );
    expect(wrongPick).toHaveClass(
      'border-destructive-20',
      'bg-destructive-0',
      'text-destructive-80',
    );
    expect(screen.getByRole('radio', { name: /it has an error/i })).toHaveClass(
      'border-accent-20',
      'bg-accent-0',
      'text-accent-90',
    );
    expect(wrongPick).toHaveAccessibleName(/your answer was incorrect/i);
    expect(
      screen.getByRole('radio', { name: /it has an error/i }),
    ).toHaveAccessibleName(/correct answer/i);

    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledWith({
      kind: 'graded',
      correct: false,
      rating: 1,
    });
  });

  it('falls back to exercise explanation for wrong judgments without feedback', async () => {
    const user = userEvent.setup();
    render(
      <FlashCardJudge
        exercise={{
          ...exercise,
          explanation: [
            {
              kind: 'text' as const,
              value: 'This sentence needs the usual finite verb placement.',
            },
          ],
          payload: {
            ...exercise.payload,
            feedback: null,
          },
        }}
      />,
    );

    await user.click(
      screen.getByRole('radio', { name: /the sentence is correct/i }),
    );
    await user.click(screen.getByRole('button', { name: /check/i }));

    expect(
      screen.getByText(/usual finite verb placement/i),
    ).toBeInTheDocument();
  });
});

describe('FlashCardJudge — stimulus hierarchy', () => {
  it('test_judge_stimulus_given_render_expect_labeled_bordered_tinted_surface', () => {
    render(<FlashCardJudge exercise={exercise} />);

    const label = screen.getByText('The sentence');
    expect(label).toHaveClass('type-label');

    const stimulus = getStimulusSurface();
    expect(stimulus).toHaveClass(
      'radius-field',
      'border',
      'border-border',
      'bg-secondary-5',
      'p-4',
    );
  });

  it('test_judge_stimulus_given_render_expect_norwegian_language_metadata_retained', () => {
    render(<FlashCardJudge exercise={exercise} />);

    const sentence = screen.getByText(
      (_, element) =>
        element?.getAttribute('lang') === 'no' &&
        element.textContent?.includes(SENTENCE) === true,
    );
    expect(sentence).toHaveAttribute('lang', 'no');
  });

  it('test_judge_stimulus_given_render_expect_prompt_stimulus_verdicts_order', () => {
    render(<FlashCardJudge exercise={exercise} />);

    const prompt = screen.getByRole('heading', {
      name: /judge the sentence\./i,
    });
    const stimulus = getStimulusSurface();
    const verdicts = screen.getByRole('radiogroup', {
      name: /grammatically correct/i,
    });

    expect(verdicts).toHaveAttribute('aria-describedby', 'judge-stimulus');
    const FOLLOWS = Node.DOCUMENT_POSITION_FOLLOWING;
    expect(prompt.compareDocumentPosition(stimulus) & FOLLOWS).toBeTruthy();
    expect(stimulus.compareDocumentPosition(verdicts) & FOLLOWS).toBeTruthy();
  });
});
