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
    render(<FlashCardChoose allowRetry={false} exercise={exercise} />);

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
    render(
      <FlashCardChoose
        allowRetry={false}
        exercise={exercise}
        onFinished={onFinished}
      />,
    );

    await user.click(screen.getByRole('radio', { name: /^snakker$/i }));
    await user.click(screen.getByRole('button', { name: /check/i }));

    expect(screen.getByText(/^correct$/i)).toBeInTheDocument();
    expect(screen.getByText(/finite verb agrees here/i)).toBeInTheDocument();
    const correctChoice = screen.getByRole('radio', { checked: true });
    expect(correctChoice).toBeDisabled();
    expect(correctChoice).toHaveAttribute('data-state', 'correct');
    expect(correctChoice).toHaveAccessibleName(/snakker.*correct/);

    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'graded', correct: true }),
    );
  });

  it('scores wrong answers and reveals the explanation text', async () => {
    const onFinished = vi.fn();
    const user = userEvent.setup();
    render(
      <FlashCardChoose
        allowRetry={false}
        exercise={exercise}
        onFinished={onFinished}
      />,
    );

    await user.click(screen.getByRole('radio', { name: /^snakke$/i }));
    await user.click(screen.getByRole('button', { name: /check/i }));

    expect(screen.getByText(/not quite/i)).toBeInTheDocument();
    expect(screen.getByText(/infinitive is wrong here/i)).toBeInTheDocument();
    const wrongChoice = screen.getByRole('radio', { checked: true });
    expect(wrongChoice).toHaveAttribute('data-state', 'incorrect');
    expect(wrongChoice).toHaveAccessibleName(/snakke.*incorrect/);

    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'graded', correct: false }),
    );
  });

  it('uses separate Check and Continue buttons (no label swap on the same element)', async () => {
    const onFinished = vi.fn();
    const user = userEvent.setup();
    render(
      <FlashCardChoose
        allowRetry={false}
        exercise={exercise}
        onFinished={onFinished}
      />,
    );

    expect(screen.getByRole('button', { name: /check/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /continue/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /^snakker$/i }));
    await user.click(screen.getByRole('button', { name: /check/i }));

    expect(
      screen.queryByRole('button', { name: /check/i }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'graded', correct: true }),
    );
  });
});
