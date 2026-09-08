import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Exercise } from '@/types/lesson-contracts';

import { FlashCardCategorize } from './FlashCardCategorize';

type CategorizeExercise = Extract<Exercise, { operation: 'categorize' }>;

const TRAY_ID = '__categorize-tray__';

/**
 * Build a minimal categorize exercise for tests.
 *
 * Items carry a `bucket_id` that is the CORRECT bucket — the component
 * must not reveal it before Check. Tests exercise the shared assignment
 * handler via tap-to-place (click item to arm, click bucket DropZone to
 * place).
 */
function makeExercise(): CategorizeExercise {
  return {
    kind: 'exercise',
    objective_id: 'obj-1',
    id: 'categorize-1',
    operation: 'categorize',
    prompt: [{ kind: 'text', value: 'Sort each noun by gender.' }],
    explanation: null,
    payload: {
      buckets: [
        { bucket_id: 'common', label: 'Common gender' },
        { bucket_id: 'neuter', label: 'Neuter' },
      ],
      items: [
        { item_id: 'bok', text: 'en bok', bucket_id: 'common' },
        { item_id: 'hus', text: 'et hus', bucket_id: 'neuter' },
      ],
    },
  };
}

/**
 * All rendered TokenChips that are interactive (buttons). Fixed-state
 * chips render as <span>; interactive ones render as <button>.
 */
function itemChips() {
  return screen
    .getAllByTestId('token-chip')
    .filter((el) => el.tagName === 'BUTTON');
}

/** Locate a DropZone by its dnd-kit id attribute. */
function getDropZone(id: string): HTMLElement {
  const zone = screen
    .getAllByTestId('drop-zone')
    .find((el) => el.getAttribute('data-dropzone-id') === id);
  if (!zone) throw new Error(`DropZone ${id} not rendered`);
  return zone;
}

/** Chips currently inside a given DropZone. */
function chipsInZone(zoneId: string) {
  const zone = getDropZone(zoneId);
  return within(zone)
    .queryAllByTestId('token-chip')
    .filter((el) => el.tagName === 'BUTTON');
}

describe('FlashCardCategorize', () => {
  it('renders all items in the tray and all buckets initially', () => {
    render(<FlashCardCategorize exercise={makeExercise()} />);

    // All items present and interactive (buttons, not spans) in the tray.
    expect(chipsInZone(TRAY_ID)).toHaveLength(2);
    expect(screen.getByText('en bok')).toBeInTheDocument();
    expect(screen.getByText('et hus')).toBeInTheDocument();

    // Bucket labels visible.
    expect(screen.getByText('Common gender')).toBeInTheDocument();
    expect(screen.getByText('Neuter')).toBeInTheDocument();

    // Buckets start empty.
    expect(chipsInZone('common')).toHaveLength(0);
    expect(chipsInZone('neuter')).toHaveLength(0);
  });

  it('renders no <select> elements (old interaction is gone)', () => {
    render(<FlashCardCategorize exercise={makeExercise()} />);
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('disables Check until every item is assigned', () => {
    render(<FlashCardCategorize exercise={makeExercise()} />);
    expect(screen.getByRole('button', { name: /check/i })).toBeDisabled();
  });

  it('shows the mobile hint copy for idle and armed tap-to-place states', async () => {
    const user = userEvent.setup();
    render(<FlashCardCategorize exercise={makeExercise()} />);

    expect(
      screen.getByText('Tap a word, then tap its group — or drag it.'),
    ).toBeInTheDocument();

    await user.click(screen.getByText('en bok'));
    expect(screen.getByText('Now tap a group for en bok.')).toBeInTheDocument();

    await user.click(getDropZone('common'));
    expect(
      screen.getByText('Tap a word, then tap its group — or drag it.'),
    ).toBeInTheDocument();
  });

  // --- Retry flow tests ---

  it('first-try solve → Easy (4)', async () => {
    const onFinished = vi.fn();
    const user = userEvent.setup();
    render(
      <FlashCardCategorize exercise={makeExercise()} onFinished={onFinished} />,
    );

    // Place both items correctly.
    await user.click(screen.getByText('en bok'));
    await user.click(getDropZone('common'));
    await user.click(screen.getByText('et hus'));
    await user.click(getDropZone('neuter'));

    await user.click(screen.getByRole('button', { name: /check/i }));
    expect(screen.getByText(/^correct$/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledWith({
      kind: 'graded',
      correct: true,
      rating: 4,
    });
  });

  it('wrong check → alert present, no per-item colors, board stays editable', async () => {
    const user = userEvent.setup();
    render(<FlashCardCategorize exercise={makeExercise()} />);

    // Swap: put "en bok" in Neuter and "et hus" in Common gender.
    await user.click(screen.getByText('en bok'));
    await user.click(getDropZone('neuter'));
    await user.click(screen.getByText('et hus'));
    await user.click(getDropZone('common'));

    await user.click(screen.getByRole('button', { name: /check/i }));

    // Alert message present (sr-only live region; visible banner has no role).
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveClass('sr-only');
    expect(alerts[0]).toHaveTextContent(
      /incorrect — adjust your answer and try again./i,
    );

    // No per-item colors on wrong check.
    for (const chip of itemChips()) {
      expect(chip).toHaveAttribute('data-state', 'idle');
    }

    // Board stays editable: chips NOT disabled.
    for (const chip of itemChips()) {
      expect(chip).not.toBeDisabled();
    }

    // Chips have NOT relocated — they stay where the learner put them.
    expect(
      within(getDropZone('neuter')).getByText('en bok'),
    ).toBeInTheDocument();
    expect(
      within(getDropZone('common')).getByText('et hus'),
    ).toBeInTheDocument();
  });

  it('dirty gate: Check disabled after wrong check, re-enabled after board change', async () => {
    const user = userEvent.setup();
    render(<FlashCardCategorize exercise={makeExercise()} />);

    // Put both items wrong.
    await user.click(screen.getByText('en bok'));
    await user.click(getDropZone('neuter'));
    await user.click(screen.getByText('et hus'));
    await user.click(getDropZone('common'));

    await user.click(screen.getByRole('button', { name: /check/i }));

    // Check is now disabled (dirty gate).
    expect(screen.getByRole('button', { name: /^check/i })).toBeDisabled();

    // Change an assignment: move "en bok" back to tray, then to common.
    await user.click(screen.getByText('en bok'));
    await user.click(screen.getByText('en bok')); // disarm back to tray
    await user.click(screen.getByText('en bok'));
    await user.click(getDropZone('common'));

    // Check re-enabled.
    expect(screen.getByRole('button', { name: /^check/i })).not.toBeDisabled();
  });

  it('solve after a wrong → Hard (2)', async () => {
    const onFinished = vi.fn();
    const user = userEvent.setup();
    render(
      <FlashCardCategorize exercise={makeExercise()} onFinished={onFinished} />,
    );

    // Wrong first.
    await user.click(screen.getByText('en bok'));
    await user.click(getDropZone('neuter'));
    await user.click(screen.getByText('et hus'));
    await user.click(getDropZone('common'));
    await user.click(screen.getByRole('button', { name: /check/i }));

    // Fix: return both to tray, place correctly.
    await user.click(screen.getByText('en bok'));
    await user.click(screen.getByText('en bok'));
    await user.click(screen.getByText('et hus'));
    await user.click(screen.getByText('et hus'));

    await user.click(screen.getByText('en bok'));
    await user.click(getDropZone('common'));
    await user.click(screen.getByText('et hus'));
    await user.click(getDropZone('neuter'));

    await user.click(screen.getByRole('button', { name: /check/i }));
    expect(screen.getByText(/^correct$/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledWith({
      kind: 'graded',
      correct: true,
      rating: 2,
    });
  });

  it('reveal shows the correct grouping and chip colors', async () => {
    const user = userEvent.setup();
    render(<FlashCardCategorize exercise={makeExercise()} />);

    // en bok correct (common); et hus wrong (common too).
    await user.click(screen.getByText('en bok'));
    await user.click(getDropZone('common'));
    await user.click(screen.getByText('et hus'));
    await user.click(getDropZone('common'));

    await user.click(screen.getByRole('button', { name: /check/i }));
    await user.click(screen.getByRole('button', { name: /reveal answer/i }));

    // Revealed banner.
    expect(screen.getByText(/here's the answer\./i)).toBeInTheDocument();

    // Both chips relocate to their correct buckets.
    expect(
      within(getDropZone('common')).getByText('en bok'),
    ).toBeInTheDocument();
    expect(
      within(getDropZone('neuter')).getByText('et hus'),
    ).toBeInTheDocument();

    // Per-chip colors show after reveal, reflecting what the learner chose.
    const enBok = within(getDropZone('common')).getByTestId('token-chip');
    const etHus = within(getDropZone('neuter')).getByTestId('token-chip');
    expect(enBok).toHaveAttribute('data-state', 'correct');
    expect(etHus).toHaveAttribute('data-state', 'wrong');
  });

  it('reveal >= 0.5 → Hard (2)', async () => {
    const onFinished = vi.fn();
    const user = userEvent.setup();
    render(
      <FlashCardCategorize exercise={makeExercise()} onFinished={onFinished} />,
    );

    // 1 of 2 correct (en bok in common) → fraction = 0.5.
    await user.click(screen.getByText('en bok'));
    await user.click(getDropZone('common'));
    await user.click(screen.getByText('et hus'));
    await user.click(getDropZone('common'));

    await user.click(screen.getByRole('button', { name: /check/i }));
    await user.click(screen.getByRole('button', { name: /reveal answer/i }));
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(onFinished).toHaveBeenCalledWith({
      kind: 'graded',
      correct: false,
      rating: 2,
    });
  });

  it('reveal < 0.5 → Again (1)', async () => {
    const onFinished = vi.fn();
    const user = userEvent.setup();
    render(
      <FlashCardCategorize exercise={makeExercise()} onFinished={onFinished} />,
    );

    // 0 of 2 correct → fraction = 0.
    await user.click(screen.getByText('en bok'));
    await user.click(getDropZone('neuter'));
    await user.click(screen.getByText('et hus'));
    await user.click(getDropZone('common'));

    await user.click(screen.getByRole('button', { name: /check/i }));
    await user.click(screen.getByRole('button', { name: /reveal answer/i }));
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(onFinished).toHaveBeenCalledWith({
      kind: 'graded',
      correct: false,
      rating: 1,
    });
  });

  it('disables chips after terminal phase (solved)', async () => {
    const user = userEvent.setup();
    render(<FlashCardCategorize exercise={makeExercise()} />);

    // Place both items correctly.
    await user.click(screen.getByText('en bok'));
    await user.click(getDropZone('common'));
    await user.click(screen.getByText('et hus'));
    await user.click(getDropZone('neuter'));

    await user.click(screen.getByRole('button', { name: /check/i }));

    for (const chip of itemChips()) {
      expect(chip).toBeDisabled();
    }
  });

  it('can return a chip to the tray by activating an armed placed chip again', async () => {
    const user = userEvent.setup();
    render(<FlashCardCategorize exercise={makeExercise()} />);

    // Place both items.
    await user.click(screen.getByText('en bok'));
    await user.click(getDropZone('common'));
    await user.click(screen.getByText('et hus'));
    await user.click(getDropZone('neuter'));

    // Arm "en bok" (in the common bucket) then activate it again to return it.
    await user.click(screen.getByText('en bok'));
    await user.click(screen.getByText('en bok'));

    // Check button should be disabled again (one item unassigned).
    expect(screen.getByRole('button', { name: /check/i })).toBeDisabled();
    expect(chipsInZone(TRAY_ID)).toHaveLength(1);
    expect(chipsInZone('common')).toHaveLength(0);
  });

  it('supports keyboard-only arm and place flow', async () => {
    const user = userEvent.setup();
    render(<FlashCardCategorize exercise={makeExercise()} />);

    await user.tab();
    expect(screen.getByRole('button', { name: 'en bok' })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'en bok' })).toHaveAttribute(
      'data-state',
      'selected',
    );

    await user.tab();
    expect(screen.getByRole('button', { name: 'et hus' })).toHaveFocus();

    await user.tab();
    const commonBucket = screen.getByRole('button', {
      name: 'Common gender',
    });
    expect(commonBucket).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(chipsInZone('common')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /check/i })).toBeDisabled();
  });
});
