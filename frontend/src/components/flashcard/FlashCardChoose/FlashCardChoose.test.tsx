import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FlashCardChoose } from './FlashCardChoose';

const exercise = {
  kind: 'exercise' as const,
  objective_id: 'obj-1',
  id: 'choose-1',
  operation: 'choose' as const,
  prompt: [{ kind: 'text' as const, value: 'Choose the right sentence.' }],
  explanation: null,
  payload: {
    stem: [{ kind: 'text' as const, value: 'Han ___ norsk.' }],
    answer_id: 'opt-1',
    options: [
      { option_id: 'opt-1', text: 'snakker', why: 'Finite verb agrees here.' },
      { option_id: 'opt-2', text: 'snakke', why: 'Infinitive is wrong here.' },
      { option_id: 'opt-3', text: 'snakket', why: 'Past tense is wrong here.' },
    ],
  },
};

describe('FlashCardChoose', () => {
  it('supports arrow-key radio movement and selection', async () => {
    const user = userEvent.setup();
    render(<FlashCardChoose exercise={exercise} />);

    const stem = screen.getByTestId('choose-stem');
    expect(stem).toHaveClass('border', 'border-border', 'bg-secondary-5');

    const first = screen.getByRole('radio', { name: /^snakker$/i });
    const second = screen.getByRole('radio', { name: /^snakke$/i });

    expect(first).toHaveAttribute('tabindex', '0');
    expect(second).toHaveAttribute('tabindex', '-1');

    await user.tab();
    expect(first).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: /check/i })).not.toBeDisabled();
  });

  it('scores correct answers, reports onFinished, and disables after Check', async () => {
    const onFinished = vi.fn();
    const user = userEvent.setup();
    render(<FlashCardChoose exercise={exercise} onFinished={onFinished} />);

    await user.click(screen.getByRole('radio', { name: /^snakker$/i }));
    await user.click(screen.getByRole('button', { name: /check/i }));

    expect(screen.getByText(/^correct$/i)).toBeInTheDocument();
    expect(screen.getByText(/finite verb agrees here/i)).toBeInTheDocument();
    const correctChoice = screen.getByRole('radio', { checked: true });
    expect(correctChoice).toBeDisabled();
    expect(correctChoice).toHaveClass(
      'border-accent-20',
      'bg-accent-0',
      'text-accent-90',
    );
    expect(correctChoice).toHaveAccessibleName(/correct answer/i);

    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledWith({
      kind: 'graded',
      correct: true,
      rating: 4,
    });
  });

  it('scores wrong answers and reveals the explanation text', async () => {
    const onFinished = vi.fn();
    const user = userEvent.setup();
    render(<FlashCardChoose exercise={exercise} onFinished={onFinished} />);

    await user.click(screen.getByRole('radio', { name: /^snakke$/i }));
    await user.click(screen.getByRole('button', { name: /check/i }));

    expect(screen.getByText(/not quite/i)).toBeInTheDocument();
    expect(screen.getByText(/infinitive is wrong here/i)).toBeInTheDocument();
    const wrongChoice = screen.getByRole('radio', { checked: true });
    expect(wrongChoice).toHaveClass(
      'border-destructive-20',
      'bg-destructive-0',
      'text-destructive-80',
    );
    expect(wrongChoice).toHaveAccessibleName(/your answer was incorrect/i);

    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledWith({
      kind: 'graded',
      correct: false,
      rating: 1,
    });
  });

  it('uses separate Check and Continue buttons (no label swap on the same element)', async () => {
    // The non-retry footer must render Check and Continue as distinct button
    // instances so a fast second click or held Enter can never fall through
    // from Check to Continue on the same element.
    const onFinished = vi.fn();
    const user = userEvent.setup();
    render(<FlashCardChoose exercise={exercise} onFinished={onFinished} />);

    // Pre-check: only a Check button exists.
    expect(screen.getByRole('button', { name: /check/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /continue/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /^snakker$/i }));
    await user.click(screen.getByRole('button', { name: /check/i }));

    // Post-check: Check is gone, Continue is a distinct element.
    expect(
      screen.queryByRole('button', { name: /check/i }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(onFinished).toHaveBeenCalledWith({
      kind: 'graded',
      correct: true,
      rating: 4,
    });
  });
});
