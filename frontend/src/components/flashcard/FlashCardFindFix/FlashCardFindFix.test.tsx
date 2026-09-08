import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FlashCardFindFix } from './FlashCardFindFix';

const exercise = {
  kind: 'exercise' as const,
  objective_id: 'obj-1',
  id: 'find-fix-1',
  operation: 'find_fix' as const,
  prompt: [{ kind: 'text' as const, value: 'Find the mistake.' }],
  explanation: null,
  payload: {
    tokens: [
      { token_id: 't1', text: 'Jeg' },
      { token_id: 't2', text: 'går' },
      { token_id: 't3', text: 'bil' },
    ],
    error_token_id: 't3',
    feedback: 'Use a preposition here: Jeg går med bil.',
  },
};

describe('FlashCardFindFix', () => {
  it('scores a correct token pick and reports onFinished', async () => {
    const onFinished = vi.fn();
    const user = userEvent.setup();
    render(<FlashCardFindFix exercise={exercise} onFinished={onFinished} />);

    await user.click(screen.getByRole('button', { name: 'bil' }));
    await user.click(screen.getByRole('button', { name: /check/i }));

    expect(screen.getByText(/^correct$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'bil' })).toHaveAttribute(
      'data-state',
      'correct',
    );

    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledWith({
      kind: 'graded',
      correct: true,
      rating: 4,
    });
  });

  it('reveals both the wrong guess and the true answer after an incorrect check', async () => {
    const onFinished = vi.fn();
    const user = userEvent.setup();
    render(<FlashCardFindFix exercise={exercise} onFinished={onFinished} />);

    await user.click(screen.getByRole('button', { name: 'går' }));
    await user.click(screen.getByRole('button', { name: /check/i }));

    expect(screen.getByText(/not quite/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'går' })).toHaveAttribute(
      'data-state',
      'wrong',
    );
    expect(screen.getByRole('button', { name: 'bil' })).toHaveAttribute(
      'data-state',
      'correct',
    );
    expect(screen.getByText(/correction/i)).toBeInTheDocument();
    expect(screen.getByText(/jeg går med bil/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'går' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledWith({
      kind: 'graded',
      correct: false,
      rating: 1,
    });
  });

  it('renders the sentence inline and supports roving focus with arrow keys', async () => {
    const user = userEvent.setup();
    render(<FlashCardFindFix exercise={exercise} />);

    const firstWord = screen.getByRole('button', { name: 'Jeg' });
    const secondWord = screen.getByRole('button', { name: 'går' });

    expect(firstWord).toHaveAttribute('tabindex', '0');
    expect(secondWord).toHaveAttribute('tabindex', '-1');

    firstWord.focus();
    await user.keyboard('{ArrowRight}');

    expect(secondWord).toHaveFocus();
    expect(secondWord).toHaveAttribute('tabindex', '0');
  });
});
