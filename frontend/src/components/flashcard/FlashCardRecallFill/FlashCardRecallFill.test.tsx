import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Exercise } from '@/types/lesson-contracts';

import { FlashCardRecallFill } from './FlashCardRecallFill';

type RecallFillExercise = Extract<Exercise, { operation: 'recall_fill' }>;

/**
 * Build a minimal recall_fill exercise for tests. recall_fill is a
 * "choose the correct form" drill: each blank shows a minimal pair of forms
 * and one tap fills the slot in the sentence.
 */
function makeExercise(
  overrides: Partial<{
    segments: RecallFillExercise['payload']['segments'];
  }> = {},
): RecallFillExercise {
  return {
    kind: 'exercise',
    objective_id: 'obj-1',
    id: 'recall-fill-1',
    operation: 'recall_fill',
    prompt: [{ kind: 'text', value: 'Choose the correct form.' }],
    explanation: null,
    payload: {
      segments: overrides.segments ?? [
        { kind: 'span', spans: [{ kind: 'text', value: 'Jeg ' }] },
        {
          kind: 'blank',
          blank_id: 'verb',
          options: ['leser', 'lese', 'leste'],
          answer_index: 0,
        },
        {
          kind: 'span',
          spans: [{ kind: 'text', value: ' en bok hver kveld.' }],
        },
      ],
    },
  };
}

/** Find the inline blank slot for a given blank_id. */
function getSlot(blankId: string): HTMLElement {
  const slot = screen
    .getAllByTestId('blank-fill')
    .find((el) => el.getAttribute('data-blank-id') === blankId);
  if (!slot) throw new Error(`Blank ${blankId} not rendered`);
  return slot;
}

/** A form option button by its visible text. */
function option(text: string): HTMLElement {
  return screen.getByRole('radio', { name: text });
}

describe('FlashCardRecallFill', () => {
  it('test_recall_fill_given_repeated_span_content_expect_unique_render_keys', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    render(
      <FlashCardRecallFill
        exercise={makeExercise({
          segments: [
            { kind: 'span', spans: [{ kind: 'text', value: ' og ' }] },
            {
              kind: 'blank',
              blank_id: 'first',
              options: ['går', 'gå'],
              answer_index: 0,
            },
            { kind: 'span', spans: [{ kind: 'text', value: ' og ' }] },
            {
              kind: 'blank',
              blank_id: 'second',
              options: ['ser', 'se'],
              answer_index: 0,
            },
          ],
        })}
      />,
    );

    expect(screen.getAllByText('og')).toHaveLength(2);
    expect(
      consoleError.mock.calls.some(([message]) =>
        String(message).includes('same key'),
      ),
    ).toBe(false);
    consoleError.mockRestore();
  });

  it('renders the sentence spans and an empty slot per blank', () => {
    render(<FlashCardRecallFill exercise={makeExercise()} />);

    expect(screen.getByText(/Jeg/)).toBeInTheDocument();
    expect(screen.getByText(/en bok hver kveld/)).toBeInTheDocument();

    const slot = getSlot('verb');
    expect(slot).toHaveAttribute('data-state', 'empty');
    expect(slot).not.toHaveTextContent('...');
  });

  it('renders the forms as a "choose the correct form" radiogroup', () => {
    render(<FlashCardRecallFill exercise={makeExercise()} />);

    expect(
      screen.getByRole('radiogroup', { name: /choose the correct form/i }),
    ).toBeInTheDocument();
    expect(option('leser')).toBeInTheDocument();
    expect(option('lese')).toBeInTheDocument();
    expect(option('leste')).toBeInTheDocument();
    // No legacy <select>.
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('disables Check until every blank is filled', () => {
    render(<FlashCardRecallFill exercise={makeExercise()} />);
    expect(screen.getByRole('button', { name: /check/i })).toBeDisabled();
  });

  it('fills the slot live with one tap on a form', async () => {
    const user = userEvent.setup();
    render(<FlashCardRecallFill exercise={makeExercise()} />);

    await user.click(option('leser'));

    const slot = getSlot('verb');
    expect(slot).toHaveTextContent('leser');
    expect(slot).toHaveAttribute('data-state', 'filled');
    expect(option('leser')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: /check/i })).not.toBeDisabled();
  });

  it('swaps the form when a different option is tapped', async () => {
    const user = userEvent.setup();
    render(<FlashCardRecallFill exercise={makeExercise()} />);

    await user.click(option('leser'));
    await user.click(option('lese'));

    expect(getSlot('verb')).toHaveTextContent('lese');
    expect(option('lese')).toHaveAttribute('aria-checked', 'true');
    expect(option('leser')).toHaveAttribute('aria-checked', 'false');
  });

  it('marks the correct form as "Correct" and reports correct:true', async () => {
    const onFinished = vi.fn();
    const user = userEvent.setup();
    render(
      <FlashCardRecallFill exercise={makeExercise()} onFinished={onFinished} />,
    );

    // answer_index = 0 → "leser" is correct.
    await user.click(option('leser'));
    await user.click(screen.getByRole('button', { name: /check/i }));

    expect(screen.getByText(/^correct$/i)).toBeInTheDocument();
    expect(getSlot('verb')).toHaveAttribute('data-state', 'correct');

    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledWith({
      kind: 'graded',
      correct: true,
      rating: 4,
    });
  });

  it('marks a wrong form as "Not quite" and reports correct:false', async () => {
    const onFinished = vi.fn();
    const user = userEvent.setup();
    render(
      <FlashCardRecallFill exercise={makeExercise()} onFinished={onFinished} />,
    );

    // "lese" (index 1) is wrong.
    await user.click(option('lese'));
    await user.click(screen.getByRole('button', { name: /check/i }));

    expect(screen.getByText(/not quite/i)).toBeInTheDocument();
    expect(getSlot('verb')).toHaveAttribute('data-state', 'wrong');

    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledWith({
      kind: 'graded',
      correct: false,
      rating: 1,
    });
  });

  it('disables the form options after Check', async () => {
    const user = userEvent.setup();
    render(<FlashCardRecallFill exercise={makeExercise()} />);

    await user.click(option('leser'));
    await user.click(screen.getByRole('button', { name: /check/i }));

    expect(option('leser')).toBeDisabled();
    expect(option('lese')).toBeDisabled();
  });

  it('supports keyboard selection of a form', async () => {
    const user = userEvent.setup();
    render(<FlashCardRecallFill exercise={makeExercise()} />);

    await user.tab();
    expect(option('leser')).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(option('leser')).toHaveAttribute('aria-checked', 'true');
    expect(getSlot('verb')).toHaveTextContent('leser');
  });

  it('handles multiple blanks independently', async () => {
    const user = userEvent.setup();
    render(
      <FlashCardRecallFill
        exercise={makeExercise({
          segments: [
            { kind: 'span', spans: [{ kind: 'text', value: 'Han ' }] },
            {
              kind: 'blank',
              blank_id: 'verb__present',
              options: ['går', 'gå'],
              answer_index: 0,
            },
            { kind: 'span', spans: [{ kind: 'text', value: ' og ' }] },
            {
              kind: 'blank',
              blank_id: 'verb__past',
              options: ['gikk', 'gått'],
              answer_index: 0,
            },
          ],
        })}
      />,
    );

    const groups = screen.getAllByRole('radiogroup');
    expect(groups).toHaveLength(2);

    await user.click(within(groups[0]!).getByRole('radio', { name: 'går' }));
    await user.click(within(groups[1]!).getByRole('radio', { name: 'gikk' }));

    expect(getSlot('verb__present')).toHaveTextContent('går');
    expect(getSlot('verb__past')).toHaveTextContent('gikk');
    expect(screen.getByRole('button', { name: /check/i })).not.toBeDisabled();
  });
});
