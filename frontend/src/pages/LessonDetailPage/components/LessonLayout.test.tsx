import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { LessonPage } from '@/lib/lessonPages';
import type { Exercise } from '@/types/lesson-contracts';

import { LessonLayout } from './LessonLayout';

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

type LayoutOverrides = Partial<{
  progressCurrent: number;
  pages: LessonPage[] | null;
  maxReachedIndex: number;
  onGoToPage: (index: number) => void;
}>;

function renderLayout(overrides: LayoutOverrides = {}) {
  return render(
    <LessonLayout
      title="Personal Pronouns"
      progressCurrent={overrides.progressCurrent ?? 0}
      totalPages={4}
      progressPercent={50}
      pages={overrides.pages === undefined ? pages : overrides.pages}
      maxReachedIndex={overrides.maxReachedIndex}
      onGoToPage={overrides.onGoToPage}
    >
      <div>Page content</div>
    </LessonLayout>,
  );
}

describe('LessonLayout', () => {
  it('test_overall_progress_given_mid_lesson_page_expect_page_scoped_progressbar', () => {
    renderLayout({ progressCurrent: 1, maxReachedIndex: 1 });

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-label', 'Lesson page progress');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '4');
    expect(progressbar).toHaveAttribute('aria-valuenow', '2');
    expect(progressbar).toHaveAttribute('aria-valuetext', 'Page 2 of 4');

    const counter = screen.getByText('Practice 1 of 2');
    expect(counter).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByText(/Page 2 of 4/)).not.toBeInTheDocument();
  });

  it('test_overall_progress_given_final_page_expect_per_kind_counter_unchanged', () => {
    renderLayout({ progressCurrent: 3, maxReachedIndex: 3 });

    expect(screen.getByText('Practice 2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      'Page 4 of 4',
    );
  });

  it('test_overall_progress_given_completion_expect_complete_text_and_static_segments', () => {
    renderLayout({ progressCurrent: 4 });

    expect(screen.getByText('Complete')).toBeInTheDocument();
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '4');
    expect(progressbar).toHaveAttribute('aria-valuetext', 'Complete');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('test_overall_progress_given_completion_without_pages_expect_filled_fallback_bar', () => {
    renderLayout({ progressCurrent: 4, pages: null });

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '4');
    expect(progressbar).toHaveAttribute('aria-valuetext', 'Complete');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('test_lesson_title_given_multiline_title_expect_accessible_full_name', () => {
    const title =
      'Personal pronouns in everyday conversations across Norwegian dialects';
    render(
      <LessonLayout
        title={title}
        progressCurrent={0}
        totalPages={4}
        progressPercent={0}
        pages={pages}
      >
        <div>Page content</div>
      </LessonLayout>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: title }),
    ).toBeInTheDocument();
  });

  it('test_progress_segments_given_navigation_callback_expect_clickable_buttons', () => {
    renderLayout({
      progressCurrent: 1,
      maxReachedIndex: 3,
      onGoToPage: vi.fn(),
    });

    expect(screen.getByRole('group')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Go to part 2 of 2' }),
    ).toBeInTheDocument();
  });
});
