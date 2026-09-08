import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ExerciseView } from '@/components/flashcard/ExerciseView';
import type { Exercise } from '@/types/lesson-contracts';

/**
 * Lesson-surface regression test.
 *
 * Match/Build/Categorize components render via `ExerciseView` in lessons
 * (`LessonDetailSession` → `ExerciseView` → exercise component). The
 * lesson's `onFinished` ignores the rating and just advances, but the
 * no-fail/retry flow must still work on this surface. This test verifies
 * the retry flow end-to-end through the same `ExerciseView` path lessons use.
 */

function makeCategorizeExercise(): Exercise {
  return {
    kind: 'exercise',
    objective_id: 'obj-1',
    id: 'cat-lesson-1',
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

function makeBuildExercise(): Exercise {
  return {
    kind: 'exercise',
    objective_id: 'obj-1',
    id: 'build-lesson-1',
    operation: 'build',
    prompt: [{ kind: 'text', value: 'Build the sentence.' }],
    explanation: null,
    payload: {
      tokens: [
        { token_id: 't1', text: 'Jeg', fixed: true },
        { token_id: 't2', text: 'spiser', fixed: false },
        { token_id: 't3', text: 'fisk', fixed: false },
      ],
      answer_order: ['t1', 't2', 't3'],
    },
  };
}

function makeMatchExercise(): Exercise {
  return {
    kind: 'exercise',
    objective_id: 'obj-1',
    id: 'match-lesson-1',
    operation: 'match_pairs',
    prompt: [{ kind: 'text', value: 'Match each phrase.' }],
    explanation: null,
    payload: {
      left: [
        { left_id: 'l1', text: 'jeg leser' },
        { left_id: 'l2', text: 'hun skriver' },
      ],
      right: [
        { right_id: 'r1', text: 'I read' },
        { right_id: 'r2', text: 'she writes' },
      ],
      pairs: [
        { left_id: 'l1', right_id: 'r1' },
        { left_id: 'l2', right_id: 'r2' },
      ],
    },
  };
}

describe('Lesson-surface regression: retry flow via ExerciseView', () => {
  it('Categorize: wrong check shows alert (not a locked failure) and allows reveal', async () => {
    const user = userEvent.setup();
    const onFinished = vi.fn();
    render(
      <ExerciseView
        exercise={makeCategorizeExercise()}
        onFinished={onFinished}
      />,
    );

    // Put both items in the wrong buckets.
    await user.click(screen.getByText('en bok'));
    await user.click(
      screen
        .getAllByTestId('drop-zone')
        .find((el) => el.getAttribute('data-dropzone-id') === 'neuter')!,
    );
    await user.click(screen.getByText('et hus'));
    await user.click(
      screen
        .getAllByTestId('drop-zone')
        .find((el) => el.getAttribute('data-dropzone-id') === 'common')!,
    );

    await user.click(screen.getByRole('button', { name: /check/i }));

    // No-fail: exactly one alert (sr-only live region; visible banner has no role).
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveClass('sr-only');
    expect(alerts[0]).toHaveTextContent(
      /incorrect — adjust your answer and try again./i,
    );

    // Reveal is available.
    expect(
      screen.getByRole('button', { name: /reveal answer/i }),
    ).toBeInTheDocument();

    // Reveal + Continue → onFinished called (lesson advances).
    await user.click(screen.getByRole('button', { name: /reveal answer/i }));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledOnce();
  });

  it('Build: wrong check shows alert and allows retry-then-solve', async () => {
    const user = userEvent.setup();
    const onFinished = vi.fn();
    render(
      <ExerciseView exercise={makeBuildExercise()} onFinished={onFinished} />,
    );

    // Wrong order: fisk, spiser.
    await user.click(screen.getByRole('button', { name: /add fisk/i }));
    await user.click(screen.getByRole('button', { name: /add spiser/i }));
    await user.click(screen.getByRole('button', { name: /check/i }));

    // Alert, not a locked failure.
    expect(screen.getAllByRole('alert')).toHaveLength(1);

    // Fix: remove both, place correctly.
    await user.click(screen.getByRole('button', { name: /remove fisk/i }));
    await user.click(screen.getByRole('button', { name: /remove spiser/i }));
    await user.click(screen.getByRole('button', { name: /add spiser/i }));
    await user.click(screen.getByRole('button', { name: /add fisk/i }));
    await user.click(screen.getByRole('button', { name: /check/i }));

    expect(screen.getByText(/^correct$/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledOnce();
  });

  it('test_match_tiles_given_v4_exercise_view_expect_two_columns_without_language_labels', () => {
    render(<ExerciseView exercise={makeMatchExercise()} />);

    // Two-column layout: one left text and one right text are present as buttons.
    expect(
      screen.getByRole('button', { name: /^jeg leser$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^I read$/i }),
    ).toBeInTheDocument();

    // No NO/EN language chips are rendered.
    expect(screen.queryByText('NO')).not.toBeInTheDocument();
    expect(screen.queryByText('EN')).not.toBeInTheDocument();

    // Center gutter marks the matching affordance.
    expect(screen.getByText('↔')).toBeInTheDocument();

    // Check always disabled — auto-completes via tile taps.
    expect(screen.getByRole('button', { name: /check/i })).toBeDisabled();
  });
});
