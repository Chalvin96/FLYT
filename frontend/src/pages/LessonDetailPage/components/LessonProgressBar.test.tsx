import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { LessonPage } from '@/lib/lessonPages';
import type { Exercise, SectionPacket } from '@/types/lesson-contracts';

import { LessonProgressBar } from './LessonProgressBar';

const section = (title: string): LessonPage => ({
  kind: 'section',
  id: `page-${title}`,
  section: {
    kind: 'section',
    id: `section-${title}`,
    role: 'orient',
    title,
    objective_ids: ['objective-1'],
    blocks: [],
  } satisfies SectionPacket,
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

  it('test_segment_hit_area_given_rendered_bar_expect_24px_button_with_8px_visual', () => {
    render(
      <LessonProgressBar
        pages={pages}
        currentIndex={0}
        maxReachedIndex={0}
        onGoToPage={vi.fn()}
      />,
    );

    // jsdom paints nothing, so the target box and the fill height are the
    // height utilities themselves.
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveClass('h-6');

      const visual = within(button).getByTestId('lesson-progress-segment');
      expect(visual).toHaveClass(
        button.getAttribute('aria-current') === 'step' ? 'h-3.5' : 'h-2',
      );
    }
  });

  it('test_segment_visual_given_current_state_expect_reached_index_marked_current', () => {
    render(
      <LessonProgressBar
        pages={pages}
        currentIndex={1}
        maxReachedIndex={3}
        onGoToPage={vi.fn()}
      />,
    );

    const current = screen.getByRole('button', {
      name: 'Go to practice 1 of 2, current',
    });
    expect(current).toHaveAttribute('aria-current', 'step');
    expect(current).not.toHaveAttribute('aria-disabled');

    for (const label of ['Go to part 2 of 2', 'Go to practice 2 of 2']) {
      expect(screen.getByRole('button', { name: label })).not.toHaveAttribute(
        'aria-current',
      );
      expect(screen.getByRole('button', { name: label })).not.toHaveAttribute(
        'aria-disabled',
      );
    }

    expect(
      screen.getByRole('button', { name: 'Go to part 1 of 2' }),
    ).not.toHaveAttribute('aria-disabled');
  });

  it('test_locked_segments_given_unreached_pages_expect_announced_locked_state', () => {
    render(
      <LessonProgressBar
        pages={pages}
        currentIndex={0}
        maxReachedIndex={0}
        onGoToPage={vi.fn()}
      />,
    );

    for (const label of [
      'Go to part 2 of 2, locked',
      'Go to practice 1 of 2, locked',
      'Go to practice 2 of 2, locked',
    ]) {
      expect(screen.getByRole('button', { name: label })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    }

    expect(
      screen.getByRole('button', { name: 'Go to part 1 of 2, current' }),
    ).not.toHaveAttribute('aria-disabled');
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

    const furthest = screen.getByRole('button', {
      name: 'Go to practice 2 of 2',
    });
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

    expect(screen.getAllByTestId('lesson-progress-segment')).toHaveLength(
      pages.length,
    );
  });

  it('test_progress_segment_given_current_page_expect_data_state_current', () => {
    render(
      <LessonProgressBar
        pages={pages}
        currentIndex={1}
        maxReachedIndex={1}
        onGoToPage={vi.fn()}
      />,
    );

    const current = screen.getByRole('button', {
      name: 'Go to practice 1 of 2, current',
    });
    expect(segmentVisual(current)).toHaveAttribute('data-state', 'current');
  });

  it('test_progress_segment_given_reached_page_expect_data_state_completed', () => {
    render(
      <LessonProgressBar
        pages={pages}
        currentIndex={2}
        maxReachedIndex={2}
        onGoToPage={vi.fn()}
      />,
    );

    const completed = screen.getByRole('button', {
      name: 'Go to part 1 of 2',
    });
    expect(segmentVisual(completed)).toHaveAttribute('data-state', 'completed');
  });

  it('test_progress_segment_given_future_page_expect_data_state_locked', () => {
    render(
      <LessonProgressBar
        pages={pages}
        currentIndex={0}
        maxReachedIndex={0}
        onGoToPage={vi.fn()}
      />,
    );

    const locked = screen.getByRole('button', {
      name: 'Go to practice 1 of 2, locked',
    });
    expect(segmentVisual(locked)).toHaveAttribute('data-state', 'locked');
  });
});
