import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { LessonPage } from '@/lib/lessonPages';
import type { Exercise } from '@/types/lesson-contracts';

import { LessonProgressBar } from './LessonProgressBar';

const section = (title: string): LessonPage => ({
  kind: 'section',
  id: `page-${title}`,
  sectionId: `section-${title}`,
  role: 'orient',
  title,
  blocks: [],
});

const exercise = (id: string): LessonPage => {
  const value: Exercise = {
    kind: 'exercise',
    id,
    operation: 'choose',
    objective_id: 'objective-1',
    prompt: [],
    explanation: null,
    payload: {
      options: [
        { option_id: 'a', text: 'A' },
        { option_id: 'b', text: 'B' },
      ],
      answer_id: 'a',
    },
  };
  return {
    kind: 'exercise',
    id: `page-${id}`,
    exerciseId: id,
    exercise: value,
  };
};

const pages: LessonPage[] = [
  section('Intro'),
  exercise('exercise-1'),
  section('Model'),
  exercise('exercise-2'),
];

function segmentVisual(button: HTMLElement) {
  return within(button).getByTestId('lesson-progress-segment');
}

describe('LessonProgressBar', () => {
  it('test_progress_bar_given_mixed_page_kinds_expect_positions_counted_within_kind', () => {
    render(
      <LessonProgressBar
        pages={pages}
        currentIndex={3}
        maxReachedIndex={3}
        onGoToPage={vi.fn()}
      />,
    );

    for (const label of [
      'Go to part 1 of 2',
      'Go to practice 1 of 2',
      'Go to part 2 of 2',
      'Go to practice 2 of 2, current',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(
      screen.queryByRole('button', { name: /of 4/ }),
    ).not.toBeInTheDocument();
  });

  it('test_lesson_progress_bar_given_page_count_expect_renders_accessible_segment_buttons', () => {
    render(
      <LessonProgressBar
        pages={pages}
        currentIndex={0}
        maxReachedIndex={0}
        onGoToPage={vi.fn()}
      />,
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(pages.length);
    expect(
      screen.getByRole('button', { name: 'Go to part 1 of 2, current' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Go to practice 1 of 2, locked' }),
    ).toBeInTheDocument();
  });

  it('test_current_segment_given_active_page_expect_aria_current_step', () => {
    render(
      <LessonProgressBar
        pages={pages}
        currentIndex={1}
        maxReachedIndex={1}
        onGoToPage={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Go to practice 1 of 2, current' }),
    ).toHaveAttribute('aria-current', 'step');
    for (const label of [
      'Go to part 1 of 2',
      'Go to part 2 of 2, locked',
      'Go to practice 2 of 2, locked',
    ]) {
      expect(screen.getByRole('button', { name: label })).not.toHaveAttribute(
        'aria-current',
      );
    }
  });

  it('test_segment_fill_given_page_kind_expect_kind_hue_and_shape', () => {
    render(
      <LessonProgressBar
        pages={pages}
        currentIndex={1}
        maxReachedIndex={3}
        onGoToPage={vi.fn()}
      />,
    );

    const exerciseVisual = segmentVisual(
      screen.getByRole('button', { name: 'Go to practice 1 of 2, current' }),
    );
    expect(exerciseVisual?.className).toContain('bg-progress-primary-current');
    expect(exerciseVisual?.className).not.toContain('rounded-');
    expect(exerciseVisual?.className).not.toContain('ring');

    const sectionVisual = segmentVisual(
      screen.getByRole('button', { name: 'Go to part 2 of 2' }),
    );
    expect(sectionVisual?.className).toContain(
      'bg-progress-secondary-complete',
    );
    expect(sectionVisual?.className).toContain('rounded-full');

    const lastVisual = segmentVisual(
      screen.getByRole('button', { name: 'Go to practice 2 of 2' }),
    );
    expect(lastVisual?.className).toContain('rounded-r-full');
  });

  it('test_locked_segments_given_mixed_kinds_expect_shape_cue_beyond_color', () => {
    render(
      <LessonProgressBar
        pages={pages}
        currentIndex={0}
        maxReachedIndex={0}
        onGoToPage={vi.fn()}
      />,
    );

    const lockedSection = segmentVisual(
      screen.getByRole('button', { name: 'Go to part 2 of 2, locked' }),
    );
    expect(lockedSection?.className).toContain('rounded-full');

    const lockedExercise = segmentVisual(
      screen.getByRole('button', { name: 'Go to practice 1 of 2, locked' }),
    );
    expect(lockedExercise?.className).not.toContain('rounded-');
  });

  it('test_segment_fill_given_locked_or_completed_state_expect_state_tokens', () => {
    render(
      <LessonProgressBar
        pages={pages}
        currentIndex={2}
        maxReachedIndex={2}
        onGoToPage={vi.fn()}
      />,
    );

    const pastExercise = segmentVisual(
      screen.getByRole('button', { name: 'Go to practice 1 of 2' }),
    );
    expect(pastExercise?.className).toContain('bg-progress-primary-complete');
    expect(pastExercise?.className).not.toContain('cursor-not-allowed');

    const lockedVisual = segmentVisual(
      screen.getByRole('button', { name: 'Go to practice 2 of 2, locked' }),
    );
    expect(lockedVisual?.className).toContain('bg-progress-primary-locked');
  });

  it('test_segment_hit_area_given_rendered_bar_expect_24px_button_with_8px_visual', () => {
    render(
      <LessonProgressBar
        pages={pages}
        currentIndex={0}
        maxReachedIndex={0}
        onGoToPage={vi.fn()}
      />,
    );

    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toContain('h-6');
      expect(segmentVisual(button)?.className).toContain('h-2');
    }
  });

  it('test_segment_focus_given_rendered_bar_expect_focus_ring_classes', () => {
    render(
      <LessonProgressBar
        pages={pages}
        currentIndex={0}
        maxReachedIndex={0}
        onGoToPage={vi.fn()}
      />,
    );

    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toContain('focus-visible:ring-2');
      expect(button.className).toContain('focus-visible:ring-ring');
      expect(button.className).toContain(
        'focus-visible:ring-offset-background',
      );
    }
  });

  it('test_furthest_segment_given_reached_index_expect_clickable_completed', async () => {
    const onGoToPage = vi.fn();
    render(
      <LessonProgressBar
        pages={pages}
        currentIndex={1}
        maxReachedIndex={3}
        onGoToPage={onGoToPage}
      />,
    );

    // index 3 == maxReachedIndex: reachable, so it must be completed + clickable
    const furthest = screen.getByRole('button', {
      name: 'Go to practice 2 of 2',
    });
    expect(segmentVisual(furthest)?.className).toContain(
      'bg-progress-primary-complete',
    );
    expect(furthest.className).not.toContain('cursor-not-allowed');
    expect(furthest).not.toHaveAttribute('aria-disabled');

    await userEvent.click(furthest);
    expect(onGoToPage).toHaveBeenCalledWith(3);
  });

  it('test_progress_bar_given_past_or_current_segment_click_expect_on_go_to_page', async () => {
    const onGoToPage = vi.fn();
    render(
      <LessonProgressBar
        pages={pages}
        currentIndex={2}
        maxReachedIndex={2}
        onGoToPage={onGoToPage}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Go to practice 1 of 2' }),
    );

    expect(onGoToPage).toHaveBeenCalledWith(1);
  });

  it('test_progress_bar_given_future_segment_click_expect_no_navigation_and_aria_disabled', async () => {
    const onGoToPage = vi.fn();
    render(
      <LessonProgressBar
        pages={pages}
        currentIndex={0}
        maxReachedIndex={0}
        onGoToPage={onGoToPage}
      />,
    );

    const future = screen.getByRole('button', {
      name: 'Go to practice 1 of 2, locked',
    });
    expect(future).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(future);
    expect(onGoToPage).not.toHaveBeenCalled();
  });

  it('test_progress_bar_given_missing_navigation_callback_expect_static_segments_without_controls', () => {
    render(
      <LessonProgressBar pages={pages} currentIndex={4} maxReachedIndex={4} />,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();

    const visuals = screen.getAllByTestId('lesson-progress-segment');
    expect(visuals).toHaveLength(pages.length);
    for (const visual of visuals) {
      expect(visual.className).toMatch(
        /bg-progress-(primary|secondary)-complete/,
      );
      expect(visual.className).not.toContain('-locked');
      expect(visual.className).not.toContain('-current');
    }
    expect(visuals[0]?.className).toContain('rounded-full');
    expect(visuals.at(-1)?.className).toContain('rounded-r-full');
  });
});
