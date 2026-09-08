import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';

import type { Exercise } from '@/types/lesson-contracts';

import { FlashCardMatch } from './FlashCardMatch';

type MatchExercise = Extract<Exercise, { operation: 'match_pairs' }>;

function makeExercise(): MatchExercise {
  return {
    kind: 'exercise',
    objective_id: 'obj-1',
    id: 'match-1',
    operation: 'match_pairs',
    prompt: [{ kind: 'text', value: 'Match each phrase.' }],
    explanation: null,
    payload: {
      left: [
        { left_id: 'l1', text: 'jeg leser' },
        { left_id: 'l2', text: 'hun skriver' },
        { left_id: 'l3', text: 'vi spiser' },
      ],
      right: [
        { right_id: 'r1', text: 'I read' },
        { right_id: 'r2', text: 'she writes' },
        { right_id: 'r3', text: 'we eat' },
      ],
      pairs: [
        { left_id: 'l1', right_id: 'r1' },
        { left_id: 'l2', right_id: 'r2' },
        { left_id: 'l3', right_id: 'r3' },
      ],
    },
  };
}

function makeManyToOneExercise(): MatchExercise {
  return {
    ...makeExercise(),
    id: 'match-many-to-one',
    payload: {
      left: [
        { left_id: 'l1', text: 'i dag' },
        { left_id: 'l2', text: 'nå' },
      ],
      right: [{ right_id: 'r1', text: 'today / now' }],
      pairs: [
        { left_id: 'l1', right_id: 'r1' },
        { left_id: 'l2', right_id: 'r1' },
      ],
    },
  };
}

function makeOverlappingIdExercise(): MatchExercise {
  return {
    ...makeExercise(),
    id: 'match-overlapping-ids',
    payload: {
      left: [{ left_id: 'shared', text: 'venstre' }],
      right: [{ right_id: 'shared', text: 'høyre' }],
      pairs: [{ left_id: 'shared', right_id: 'shared' }],
    },
  };
}

describe('FlashCardMatch', () => {
  it('test_match_pairs_given_equal_ids_across_sides_expect_pair_completes', async () => {
    const user = userEvent.setup();
    const onFinished = vi.fn();
    render(
      <FlashCardMatch
        exercise={makeOverlappingIdExercise()}
        onFinished={onFinished}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^venstre$/i }));
    await user.click(screen.getByRole('button', { name: /^høyre$/i }));
    expect(screen.getByText(/^correct$/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledWith({
      kind: 'graded',
      correct: true,
      rating: 4,
    });
  });
  it('renders all left and right items as buttons without language labels', () => {
    render(<FlashCardMatch exercise={makeExercise()} />);
    expect(
      screen.getByRole('button', { name: /^jeg leser$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^hun skriver$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^vi spiser$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^I read$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^she writes$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^we eat$/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText('NO')).not.toBeInTheDocument();
    expect(screen.queryByText('EN')).not.toBeInTheDocument();
  });

  it('arms a tile on tap (aria-pressed + selected label)', async () => {
    const user = userEvent.setup();
    render(<FlashCardMatch exercise={makeExercise()} />);
    const tile = screen.getByRole('button', { name: /^jeg leser$/i });
    await user.click(tile);
    expect(tile.getAttribute('aria-pressed')).toBe('true');
    expect(tile.getAttribute('aria-label')).toMatch(
      /selected . tap its match/i,
    );
  });

  it('disarms when the same tile is tapped twice', async () => {
    const user = userEvent.setup();
    render(<FlashCardMatch exercise={makeExercise()} />);
    const tile = screen.getByRole('button', { name: /^jeg leser$/i });
    await user.click(tile);
    expect(tile.getAttribute('aria-pressed')).toBe('true');
    await user.click(tile);
    expect(tile.getAttribute('aria-pressed')).not.toBe('true');
  });

  it('re-arms within the same column without matching', async () => {
    const user = userEvent.setup();
    render(<FlashCardMatch exercise={makeExercise()} />);
    const a = screen.getByRole('button', { name: /^jeg leser$/i });
    const b = screen.getByRole('button', { name: /^hun skriver$/i });
    await user.click(a);
    await user.click(b);
    expect(a.getAttribute('aria-pressed')).not.toBe('true');
    expect(b.getAttribute('aria-pressed')).toBe('true');
  });

  it('locks a correct pair in place (visible, disabled, matched)', async () => {
    const user = userEvent.setup();
    render(<FlashCardMatch exercise={makeExercise()} />);
    await user.click(screen.getByRole('button', { name: /^jeg leser$/i }));
    await user.click(screen.getByRole('button', { name: /^I read$/i }));

    // Locked tiles stay VISIBLE (not aria-hidden) and are findable by name.
    const leftTile = screen.getByRole('button', {
      name: /jeg leser.*matched/i,
    });
    const rightTile = screen.getByRole('button', {
      name: /I read.*matched/i,
    });
    expect(leftTile).toBeDisabled();
    expect(rightTile).toBeDisabled();
  });

  it('test_match_pairs_given_many_to_one_relations_expect_shared_target_reusable', async () => {
    const user = userEvent.setup();
    const onFinished = vi.fn();
    render(
      <FlashCardMatch
        exercise={makeManyToOneExercise()}
        onFinished={onFinished}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^i dag$/i }));
    await user.click(screen.getByRole('button', { name: /^today \/ now$/i }));

    expect(
      screen.getByRole('button', { name: /today \/ now/i }),
    ).not.toBeDisabled();

    await user.click(screen.getByRole('button', { name: /^nå$/i }));
    await user.click(screen.getByRole('button', { name: /^today \/ now$/i }));

    expect(screen.getByText(/^correct$/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledWith({
      kind: 'graded',
      correct: true,
      rating: 4,
    });
  });

  it('clean pass (no wrong taps) completes Easy (4)', async () => {
    const user = userEvent.setup();
    const onFinished = vi.fn();
    render(
      <FlashCardMatch exercise={makeExercise()} onFinished={onFinished} />,
    );
    await user.click(screen.getByRole('button', { name: /^jeg leser$/i }));
    await user.click(screen.getByRole('button', { name: /^I read$/i }));
    await user.click(screen.getByRole('button', { name: /^hun skriver$/i }));
    await user.click(screen.getByRole('button', { name: /^she writes$/i }));
    await user.click(screen.getByRole('button', { name: /^vi spiser$/i }));
    await user.click(screen.getByRole('button', { name: /^we eat$/i }));
    expect(screen.getByText(/^correct$/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledWith({
      kind: 'graded',
      correct: true,
      rating: 4,
    });
  });

  it('one or two wrong taps grade Hard (2)', async () => {
    const user = userEvent.setup();
    const onFinished = vi.fn();
    render(
      <FlashCardMatch exercise={makeExercise()} onFinished={onFinished} />,
    );

    // One wrong tap: jeg leser + she writes.
    await user.click(screen.getByRole('button', { name: /^jeg leser$/i }));
    await user.click(screen.getByRole('button', { name: /^she writes$/i }));
    await new Promise((r) => setTimeout(r, 600));

    // Complete all 3 pairs correctly.
    await user.click(screen.getByRole('button', { name: /^jeg leser$/i }));
    await user.click(screen.getByRole('button', { name: /^I read$/i }));
    await user.click(screen.getByRole('button', { name: /^hun skriver$/i }));
    await user.click(screen.getByRole('button', { name: /^she writes$/i }));
    await user.click(screen.getByRole('button', { name: /^vi spiser$/i }));
    await user.click(screen.getByRole('button', { name: /^we eat$/i }));

    expect(screen.getByText(/^correct$/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledWith({
      kind: 'graded',
      correct: true,
      rating: 2,
    });
  });

  it('three or more wrong taps grade Again (1)', async () => {
    const user = userEvent.setup();
    const onFinished = vi.fn();
    render(
      <FlashCardMatch exercise={makeExercise()} onFinished={onFinished} />,
    );

    // Three wrong taps.
    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole('button', { name: /^jeg leser$/i }));
      await user.click(screen.getByRole('button', { name: /^she writes$/i }));
      await new Promise((r) => setTimeout(r, 600));
    }

    // Complete all 3 pairs correctly.
    await user.click(screen.getByRole('button', { name: /^jeg leser$/i }));
    await user.click(screen.getByRole('button', { name: /^I read$/i }));
    await user.click(screen.getByRole('button', { name: /^hun skriver$/i }));
    await user.click(screen.getByRole('button', { name: /^she writes$/i }));
    await user.click(screen.getByRole('button', { name: /^vi spiser$/i }));
    await user.click(screen.getByRole('button', { name: /^we eat$/i }));

    expect(screen.getByText(/^correct$/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledWith({
      kind: 'graded',
      correct: true,
      rating: 1,
    });
  });

  it('Check button is always disabled (exercise auto-completes)', () => {
    render(<FlashCardMatch exercise={makeExercise()} />);
    expect(screen.getByRole('button', { name: /check/i })).toBeDisabled();
  });

  it('auto-completes a malformed payload with no pairs', async () => {
    const exercise = makeExercise();
    exercise.payload = { left: [], right: [], pairs: [] };
    render(<FlashCardMatch exercise={exercise} />);
    expect(await screen.findByText(/^correct$/i)).toBeInTheDocument();
  });
});

describe('FlashCardMatch — interaction state (fake timers)', () => {
  function tile(name: RegExp) {
    return screen.getByRole('button', { name });
  }

  function clickTile(name: RegExp) {
    fireEvent.click(tile(name));
  }

  function statusHint() {
    return screen.getByTestId('flashcard-action-status');
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('test_match_board_given_first_tile_armed_expect_target_and_dimmed_states', () => {
    render(<FlashCardMatch exercise={makeExercise()} />);

    clickTile(/^jeg leser$/i);

    const armed = tile(/jeg leser/i);
    expect(armed).toHaveAttribute('aria-pressed', 'true');
    expect(armed).toHaveClass('border-primary-70', 'bg-primary-70');

    expect(tile(/^hun skriver$/i)).toHaveClass('opacity-40');
    expect(tile(/^vi spiser$/i)).toHaveClass('opacity-40');
    expect(tile(/^I read$/i)).toHaveClass('ring-2', 'ring-primary-30');
    expect(tile(/^she writes$/i)).toHaveClass('ring-2', 'ring-primary-30');
    expect(tile(/^we eat$/i)).toHaveClass('ring-2', 'ring-primary-30');
  });

  it('test_match_board_given_wrong_pair_expect_only_attempted_tiles_flash_and_board_locked', () => {
    render(<FlashCardMatch exercise={makeExercise()} />);

    clickTile(/^jeg leser$/i);
    clickTile(/^she writes$/i);

    for (const flashed of [tile(/^jeg leser$/i), tile(/^she writes$/i)]) {
      expect(flashed).toHaveClass(
        'border-destructive-20',
        'bg-destructive-0',
        'text-destructive-80',
      );
      expect(flashed).toBeDisabled();
    }
    for (const untouched of [
      tile(/^hun skriver$/i),
      tile(/^vi spiser$/i),
      tile(/^I read$/i),
      tile(/^we eat$/i),
    ]) {
      expect(untouched).not.toHaveClass('border-destructive-20');
      expect(untouched).toBeDisabled();
    }

    expect(tile(/^jeg leser$/i)).toHaveAttribute('aria-pressed', 'false');

    clickTile(/^vi spiser$/i);
    expect(tile(/^vi spiser$/i)).toHaveAttribute('aria-pressed', 'false');

    expect(statusHint()).toHaveTextContent(/0 \/ 3 matched/i);
    expect(screen.queryByText(/^correct$/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /continue/i }),
    ).not.toBeInTheDocument();

    expect(screen.getByRole('alert')).toHaveTextContent(/not a match\./i);
  });

  it('test_match_board_given_wrong_pair_timeout_expect_board_restored_after_500ms', () => {
    render(<FlashCardMatch exercise={makeExercise()} />);

    clickTile(/^jeg leser$/i);
    clickTile(/^she writes$/i);

    expect(tile(/^jeg leser$/i)).toBeDisabled();
    act(() => {
      vi.advanceTimersByTime(500);
    });

    for (const restored of [tile(/^jeg leser$/i), tile(/^she writes$/i)]) {
      expect(restored).not.toHaveClass('border-destructive-20');
      expect(restored).not.toBeDisabled();
    }

    clickTile(/^jeg leser$/i);
    expect(tile(/jeg leser/i)).toHaveAttribute('aria-pressed', 'true');
    expect(statusHint()).toHaveTextContent(/0 \/ 3 matched/i);
    expect(
      screen.queryByRole('button', { name: /continue/i }),
    ).not.toBeInTheDocument();
  });

  it('test_match_board_given_matching_pair_expect_locked_checkmarks_and_progress_increment', () => {
    render(<FlashCardMatch exercise={makeExercise()} />);

    clickTile(/^jeg leser$/i);
    clickTile(/^I read$/i);

    const leftTile = tile(/jeg leser.*matched/i);
    const rightTile = tile(/I read.*matched/i);
    expect(leftTile).toBeDisabled();
    expect(rightTile).toBeDisabled();
    expect(leftTile.textContent).toContain('✓');
    expect(rightTile.textContent).toContain('✓');
    expect(statusHint()).toHaveTextContent(/1 \/ 3 matched/i);

    clickTile(/^hun skriver$/i);
    expect(leftTile).toHaveClass('opacity-70');
    expect(tile(/^she writes$/i)).toHaveClass('ring-2', 'ring-primary-30');
  });

  it('test_match_board_given_all_pairs_locked_expect_subtle_accent_completion_with_continue', () => {
    const onFinished = vi.fn();
    render(
      <FlashCardMatch exercise={makeExercise()} onFinished={onFinished} />,
    );

    for (const [left, right] of [
      [/^jeg leser$/i, /^I read$/i],
      [/^hun skriver$/i, /^she writes$/i],
      [/^vi spiser$/i, /^we eat$/i],
    ] as [RegExp, RegExp][]) {
      clickTile(left);
      clickTile(right);
    }

    const banner = screen.getByText(/^correct$/i);
    expect(banner).toHaveClass(
      'border-accent-20',
      'bg-accent-0',
      'text-accent-90',
    );
    expect(banner).toHaveAttribute('role', 'status');

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledWith({
      kind: 'graded',
      correct: true,
      rating: 4,
    });
  });
});
