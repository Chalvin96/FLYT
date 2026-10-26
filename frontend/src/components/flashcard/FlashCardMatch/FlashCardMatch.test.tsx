import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
        allowRetry
        exercise={makeOverlappingIdExercise()}
        onFinished={onFinished}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^venstre$/i }));
    await user.click(screen.getByRole('button', { name: /^høyre$/i }));
    expect(screen.getByText(/^correct$/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'graded', correct: true }),
    );
  });
  it('renders all left and right items as buttons without language labels', () => {
    render(<FlashCardMatch allowRetry exercise={makeExercise()} />);
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
    render(<FlashCardMatch allowRetry exercise={makeExercise()} />);
    const tile = screen.getByRole('button', { name: /^jeg leser$/i });
    await user.click(tile);
    expect(tile.getAttribute('aria-pressed')).toBe('true');
    expect(tile.getAttribute('aria-label')).toMatch(
      /selected . tap its match/i,
    );
  });

  it('disarms when the same tile is tapped twice', async () => {
    const user = userEvent.setup();
    render(<FlashCardMatch allowRetry exercise={makeExercise()} />);
    const tile = screen.getByRole('button', { name: /^jeg leser$/i });
    await user.click(tile);
    expect(tile.getAttribute('aria-pressed')).toBe('true');
    await user.click(tile);
    expect(tile.getAttribute('aria-pressed')).not.toBe('true');
  });

  it('re-arms within the same column without matching', async () => {
    const user = userEvent.setup();
    render(<FlashCardMatch allowRetry exercise={makeExercise()} />);
    const a = screen.getByRole('button', { name: /^jeg leser$/i });
    const b = screen.getByRole('button', { name: /^hun skriver$/i });
    await user.click(a);
    await user.click(b);
    expect(a.getAttribute('aria-pressed')).not.toBe('true');
    expect(b.getAttribute('aria-pressed')).toBe('true');
  });

  it('test_match_pair_given_correct_taps_expect_visible_disabled_announced_tiles', async () => {
    const user = userEvent.setup();
    render(<FlashCardMatch allowRetry exercise={makeExercise()} />);
    await user.click(screen.getByRole('button', { name: /^jeg leser$/i }));
    await user.click(screen.getByRole('button', { name: /^I read$/i }));

    // Locked tiles stay VISIBLE (not aria-hidden) and are findable by name.
    const leftTile = screen.getByRole('button', {
      name: /jeg leser.*correct/i,
    });
    const rightTile = screen.getByRole('button', {
      name: /I read.*correct/i,
    });
    expect(leftTile).toBeDisabled();
    expect(rightTile).toBeDisabled();
  });

  it('test_match_pairs_given_many_to_one_relations_expect_shared_target_reusable', async () => {
    const user = userEvent.setup();
    const onFinished = vi.fn();
    render(
      <FlashCardMatch
        allowRetry
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
    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'graded', correct: true }),
    );
  });

  it('test_match_given_no_wrong_taps_and_completed_board_expect_correct_outcome', async () => {
    const user = userEvent.setup();
    const onFinished = vi.fn();
    render(
      <FlashCardMatch
        allowRetry
        exercise={makeExercise()}
        onFinished={onFinished}
      />,
    );
    await user.click(screen.getByRole('button', { name: /^jeg leser$/i }));
    await user.click(screen.getByRole('button', { name: /^I read$/i }));
    await user.click(screen.getByRole('button', { name: /^hun skriver$/i }));
    await user.click(screen.getByRole('button', { name: /^she writes$/i }));
    await user.click(screen.getByRole('button', { name: /^vi spiser$/i }));
    await user.click(screen.getByRole('button', { name: /^we eat$/i }));
    expect(screen.getByText(/^correct$/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'graded', correct: true }),
    );
  });

  it('test_match_given_one_wrong_tap_and_completed_board_expect_correct_outcome', async () => {
    const user = userEvent.setup();
    const onFinished = vi.fn();
    render(
      <FlashCardMatch
        allowRetry
        exercise={makeExercise()}
        onFinished={onFinished}
      />,
    );

    // One wrong tap: jeg leser + she writes.
    await user.click(screen.getByRole('button', { name: /^jeg leser$/i }));
    await user.click(screen.getByRole('button', { name: /^she writes$/i }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /^jeg leser$/i }),
      ).not.toBeDisabled(),
    );

    // Complete all 3 pairs correctly.
    await user.click(screen.getByRole('button', { name: /^jeg leser$/i }));
    await user.click(screen.getByRole('button', { name: /^I read$/i }));
    await user.click(screen.getByRole('button', { name: /^hun skriver$/i }));
    await user.click(screen.getByRole('button', { name: /^she writes$/i }));
    await user.click(screen.getByRole('button', { name: /^vi spiser$/i }));
    await user.click(screen.getByRole('button', { name: /^we eat$/i }));

    expect(screen.getByText(/^correct$/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'graded', correct: true }),
    );
  });

  it('test_match_given_three_wrong_taps_and_completed_board_expect_correct_outcome', async () => {
    const user = userEvent.setup();
    const onFinished = vi.fn();
    render(
      <FlashCardMatch
        allowRetry
        exercise={makeExercise()}
        onFinished={onFinished}
      />,
    );

    // Three wrong taps.
    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole('button', { name: /^jeg leser$/i }));
      await user.click(screen.getByRole('button', { name: /^she writes$/i }));
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /^jeg leser$/i }),
        ).not.toBeDisabled(),
      );
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
    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'graded', correct: true }),
    );
  });

  it('test_match_given_wrong_tap_in_review_expect_matching_continues_to_incorrect_again', async () => {
    const user = userEvent.setup();
    const onFinished = vi.fn();
    render(
      <FlashCardMatch
        allowRetry={false}
        exercise={makeExercise()}
        onFinished={onFinished}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^jeg leser$/i }));
    await user.click(screen.getByRole('button', { name: /^she writes$/i }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /^jeg leser$/i }),
      ).not.toBeDisabled(),
    );

    expect(screen.queryByText(/^not quite$/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /continue/i })).toBeNull();
    expect(
      screen.getByRole('button', { name: /^I read$/i }),
    ).not.toBeDisabled();

    await user.click(screen.getByRole('button', { name: /^jeg leser$/i }));
    await user.click(screen.getByRole('button', { name: /^I read$/i }));
    await user.click(screen.getByRole('button', { name: /^hun skriver$/i }));
    await user.click(screen.getByRole('button', { name: /^she writes$/i }));
    await user.click(screen.getByRole('button', { name: /^vi spiser$/i }));
    await user.click(screen.getByRole('button', { name: /^we eat$/i }));

    expect(screen.getByText(/^not quite$/i)).toBeInTheDocument();
    const continueButton = screen.getByRole('button', { name: /continue/i });
    expect(continueButton).toBeEnabled();
    await user.click(continueButton);
    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'graded', correct: false }),
    );
  });

  it('test_match_given_right_pairs_in_review_expect_open_until_board_complete', async () => {
    const user = userEvent.setup();
    const onFinished = vi.fn();
    render(
      <FlashCardMatch
        allowRetry={false}
        exercise={makeExercise()}
        onFinished={onFinished}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^jeg leser$/i }));
    await user.click(screen.getByRole('button', { name: /^I read$/i }));
    expect(screen.queryByRole('button', { name: /continue/i })).toBeNull();

    await user.click(screen.getByRole('button', { name: /^hun skriver$/i }));
    await user.click(screen.getByRole('button', { name: /^she writes$/i }));
    await user.click(screen.getByRole('button', { name: /^vi spiser$/i }));
    await user.click(screen.getByRole('button', { name: /^we eat$/i }));

    expect(screen.getByText(/^correct$/i)).toBeInTheDocument();
    const continueButton = screen.getByRole('button', { name: /continue/i });
    expect(continueButton).toBeEnabled();
    await user.click(continueButton);

    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'graded', correct: true }),
    );
  });

  it('test_match_tile_given_untouched_board_expect_data_state_idle', () => {
    render(<FlashCardMatch allowRetry exercise={makeExercise()} />);
    expect(
      screen.getByRole('button', { name: /^jeg leser$/i }),
    ).toHaveAttribute('data-state', 'idle');
  });

  it('Check button is always disabled (exercise auto-completes)', () => {
    render(<FlashCardMatch allowRetry exercise={makeExercise()} />);
    expect(screen.getByRole('button', { name: /check/i })).toBeDisabled();
  });

  it('test_match_given_empty_board_expect_completed_on_first_render', () => {
    const exercise = makeExercise();
    exercise.payload = { left: [], right: [], pairs: [] };
    render(<FlashCardMatch allowRetry exercise={exercise} />);
    expect(screen.getByText(/^correct$/i)).toBeInTheDocument();
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
    render(<FlashCardMatch allowRetry exercise={makeExercise()} />);

    clickTile(/^jeg leser$/i);

    const armed = tile(/jeg leser/i);
    expect(armed).toHaveAttribute('aria-pressed', 'true');
    expect(armed).toHaveAccessibleName(/selected . tap its match/i);
  });

  it('test_match_board_given_wrong_pair_expect_only_attempted_tiles_flash_and_board_locked', () => {
    render(<FlashCardMatch allowRetry exercise={makeExercise()} />);

    clickTile(/^jeg leser$/i);
    clickTile(/^she writes$/i);

    for (const flashed of [tile(/^jeg leser$/i), tile(/^she writes$/i)]) {
      expect(flashed).toBeDisabled();
    }
    for (const untouched of [
      tile(/^hun skriver$/i),
      tile(/^vi spiser$/i),
      tile(/^I read$/i),
      tile(/^we eat$/i),
    ]) {
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

    expect(screen.getByRole('alert')).toHaveTextContent(
      /incorrect — adjust your answer and try again\./i,
    );
  });

  it('test_match_tile_given_first_tile_armed_expect_data_state_selected_and_target_and_dimmed', () => {
    render(<FlashCardMatch allowRetry exercise={makeExercise()} />);

    clickTile(/^jeg leser$/i);

    expect(tile(/jeg leser/i)).toHaveAttribute('data-state', 'selected');
    expect(tile(/^hun skriver$/i)).toHaveAttribute('data-state', 'dimmed');
    expect(tile(/^I read$/i)).toHaveAttribute('data-state', 'target');
  });

  it('test_match_tile_given_wrong_pair_expect_data_state_wrong_flash', () => {
    render(<FlashCardMatch allowRetry exercise={makeExercise()} />);

    clickTile(/^jeg leser$/i);
    clickTile(/^she writes$/i);

    expect(tile(/^jeg leser$/i)).toHaveAttribute('data-state', 'wrong-flash');
    expect(tile(/^she writes$/i)).toHaveAttribute('data-state', 'wrong-flash');
  });

  it('test_match_tile_given_matched_pair_expect_data_state_correct', () => {
    render(<FlashCardMatch allowRetry exercise={makeExercise()} />);

    clickTile(/^jeg leser$/i);
    clickTile(/^I read$/i);

    expect(tile(/jeg leser.*correct/i)).toHaveAttribute(
      'data-state',
      'correct',
    );
    expect(tile(/I read.*correct/i)).toHaveAttribute('data-state', 'correct');
  });

  it('test_match_board_given_wrong_pair_timeout_expect_board_restored_after_500ms', () => {
    render(<FlashCardMatch allowRetry exercise={makeExercise()} />);

    clickTile(/^jeg leser$/i);
    clickTile(/^she writes$/i);

    expect(tile(/^jeg leser$/i)).toBeDisabled();
    act(() => {
      vi.advanceTimersByTime(500);
    });

    for (const restored of [tile(/^jeg leser$/i), tile(/^she writes$/i)]) {
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
    render(<FlashCardMatch allowRetry exercise={makeExercise()} />);

    clickTile(/^jeg leser$/i);
    clickTile(/^I read$/i);

    const leftTile = tile(/jeg leser.*correct/i);
    const rightTile = tile(/I read.*correct/i);
    expect(leftTile).toBeDisabled();
    expect(rightTile).toBeDisabled();
    expect(leftTile.textContent).toContain('✓');
    expect(rightTile.textContent).toContain('✓');
    expect(statusHint()).toHaveTextContent(/1 \/ 3 matched/i);

    clickTile(/^hun skriver$/i);
    expect(leftTile).toBeDisabled();
    expect(leftTile).toHaveAccessibleName(/jeg leser.*correct/i);
    expect(tile(/^she writes$/i)).not.toBeDisabled();
  });

  it('test_match_board_given_all_pairs_locked_expect_completion_with_continue', () => {
    const onFinished = vi.fn();
    render(
      <FlashCardMatch
        allowRetry
        exercise={makeExercise()}
        onFinished={onFinished}
      />,
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
    expect(banner).toBeInTheDocument();
    expect(screen.getByTestId('operation-banner')).toHaveAttribute(
      'role',
      'status',
    );

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'graded', correct: true }),
    );
  });
});
