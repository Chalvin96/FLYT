import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import type { LessonSummaryRead } from '@/types/api';

import { LESSON_LEVEL_PREFERENCE_KEY } from './lessonLevel';
import { LessonPage } from './LessonPage';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    className,
    children,
  }: {
    to: string;
    params?: Record<string, string | number>;
    className?: string;
    children: ReactNode;
  }) => {
    let href = to;
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        href = href.replace(`$${key}`, String(value));
      }
    }
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  },
}));

function makeLesson(
  id: number,
  state: LessonSummaryRead['state'],
  overrides: Partial<LessonSummaryRead> = {},
): LessonSummaryRead {
  return {
    id,
    source_id: `lesson-${id}`,
    kind: 'grammar',
    family_id: 'basics',
    title: `Lesson ${id}`,
    cefr_level: 'A1',
    goal: `Goal for lesson ${id}`,
    order: id,
    state,
    estimated_minutes: 3,
    last_activity_at: null,
    ...overrides,
  };
}

const lessons: LessonSummaryRead[] = [
  makeLesson(1, 'completed', { title: 'Greetings' }),
  makeLesson(2, 'in_progress', { title: 'Personal pronouns' }),
  makeLesson(3, 'not_started', { title: 'Daily routines' }),
];

const mixedLevelLessons: LessonSummaryRead[] = [
  makeLesson(1, 'completed', { title: 'A1 foundations' }),
  makeLesson(2, 'in_progress', { title: 'A1 current lesson' }),
  makeLesson(3, 'not_started', {
    title: 'A2 first lesson',
    cefr_level: 'A2',
  }),
  makeLesson(4, 'completed', {
    title: 'A2 second lesson',
    cefr_level: 'A2',
  }),
  makeLesson(5, 'not_started', {
    title: 'B1 first lesson',
    cefr_level: 'B1',
  }),
];

describe('LessonPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('test_lesson_page_given_loading_state_expect_renders_skeletons', () => {
    render(<LessonPage lessons={[]} isLoading />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading lessons.')).toBeInTheDocument();
  });

  it('test_lesson_page_given_request_error_expect_renders_error_state_with_retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(<LessonPage lessons={[]} isError onRetry={onRetry} />);

    expect(screen.getByText(/could not load lessons/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('test_lesson_page_given_mixed_states_expect_single_incomplete_group_with_collapsed_completed', async () => {
    const user = userEvent.setup();

    render(<LessonPage lessons={lessons} />);

    expect(
      screen.getByRole('heading', { name: 'Personal pronouns', level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Lessons', level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Completed · 1' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Course lessons')).not.toBeInTheDocument();
    expect(screen.queryByText('1 of 3 completed')).not.toBeInTheDocument();
    expect(screen.getByTestId('completed-lessons')).not.toHaveAttribute('open');

    await user.click(screen.getByRole('heading', { name: 'Completed · 1' }));

    expect(screen.getByRole('link', { name: /Greetings/ })).toBeInTheDocument();
  });

  it('test_lesson_page_given_in_progress_after_upcoming_expect_latest_active_resume', () => {
    render(
      <LessonPage
        lessons={[
          makeLesson(1, 'not_started', { title: 'Earlier upcoming' }),
          makeLesson(2, 'in_progress', {
            title: 'Older active lesson',
            last_activity_at: '2026-08-19T10:00:00Z',
          }),
          makeLesson(3, 'in_progress', {
            title: 'Latest active lesson',
            last_activity_at: '2026-08-20T10:00:00Z',
          }),
        ]}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Latest active lesson', level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Earlier upcoming', level: 3 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Lessons', level: 2 }),
    ).toBeInTheDocument();
  });

  it('test_lesson_page_given_all_lessons_completed_expect_first_lesson_for_review', () => {
    render(
      <LessonPage
        lessons={[
          makeLesson(11, 'completed', { title: 'First lesson' }),
          makeLesson(12, 'completed', { title: 'Second lesson' }),
        ]}
      />,
    );

    expect(screen.getByText('All lessons completed!')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /review first lesson/i }),
    ).toHaveAttribute('href', '/lesson/11');
  });

  it('test_lesson_page_given_mixed_levels_expect_selector_and_filtered_group_order', async () => {
    const user = userEvent.setup();

    render(<LessonPage lessons={mixedLevelLessons} />);

    const trigger = screen.getByRole('button', {
      name: /choose active course/i,
    });
    expect(trigger).toHaveTextContent('Norwegian A1');
    expect(trigger).toHaveTextContent('1 of 2 lessons completed');

    await user.click(trigger);
    expect(
      screen.getByRole('radio', { name: /Norwegian A2/i }),
    ).toHaveTextContent('2 lessons · 1 completed');
    expect(
      screen.queryByRole('radio', { name: /All/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /Norwegian A2/i }));

    expect(
      screen.getByRole('heading', { name: 'Lessons', level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Completed · 1' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'A2 first lesson', level: 3 }),
    ).toBeInTheDocument();
    expect(screen.queryByText('A1 foundations')).not.toBeInTheDocument();
    expect(screen.queryByText('B1 first lesson')).not.toBeInTheDocument();
  });

  it('test_lesson_page_given_saved_level_expect_preference_restored_on_next_visit', async () => {
    const user = userEvent.setup();
    const view = render(<LessonPage lessons={mixedLevelLessons} />);

    await user.click(
      screen.getByRole('button', { name: /choose active course/i }),
    );
    await user.click(screen.getByRole('radio', { name: /Norwegian A2/i }));
    expect(window.localStorage.getItem(LESSON_LEVEL_PREFERENCE_KEY)).toBe('A2');

    view.unmount();
    render(<LessonPage lessons={mixedLevelLessons} />);

    expect(
      screen.getByRole('button', { name: /choose active course/i }),
    ).toHaveTextContent('Norwegian A2');
    expect(
      screen.getByRole('heading', { name: 'A2 first lesson', level: 2 }),
    ).toBeInTheDocument();
  });

  it('test_lesson_page_given_stale_saved_level_expect_current_level_fallback', () => {
    window.localStorage.setItem(LESSON_LEVEL_PREFERENCE_KEY, 'C1');

    render(<LessonPage lessons={mixedLevelLessons} />);

    expect(
      screen.getByRole('button', { name: /choose active course/i }),
    ).toHaveTextContent('Norwegian A1');
    expect(
      screen.getByRole('heading', { name: 'A1 current lesson', level: 2 }),
    ).toBeInTheDocument();
    expect(screen.queryByText('A2 first lesson')).not.toBeInTheDocument();
  });

  it('test_lesson_page_given_level_switch_expect_hero_and_list_use_selected_level', async () => {
    const user = userEvent.setup();

    render(<LessonPage lessons={mixedLevelLessons} />);
    await user.click(
      screen.getByRole('button', { name: /choose active course/i }),
    );
    await user.click(screen.getByRole('radio', { name: /Norwegian B1/i }));

    expect(
      screen.getByRole('heading', { name: 'B1 first lesson', level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Start this lesson' }),
    ).toHaveAttribute('href', '/lesson/5');
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
    expect(screen.queryByText('A1 current lesson')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'B1 first lesson', level: 3 }),
    ).toBeInTheDocument();
  });

  it('test_lesson_page_given_open_level_selector_expect_arrow_key_moves_selection', async () => {
    const user = userEvent.setup();

    render(<LessonPage lessons={mixedLevelLessons} />);
    await user.click(
      screen.getByRole('button', { name: /choose active course/i }),
    );

    const a1Option = screen.getByRole('radio', { name: /Norwegian A1/i });
    const a2Option = screen.getByRole('radio', { name: /Norwegian A2/i });
    a1Option.focus();

    await user.keyboard('{ArrowDown}');

    expect(a2Option).toHaveFocus();
    expect(a2Option).toHaveAttribute('aria-checked', 'true');
    expect(a1Option).toHaveAttribute('tabindex', '-1');
  });

  it('test_lesson_page_given_hero_and_catalog_expect_medium_gap_before_selector', () => {
    render(<LessonPage lessons={lessons} />);

    expect(screen.getByTestId('lesson-browse-content')).toHaveClass(
      'mt-4',
      'sm:mt-5',
    );
  });

  it('test_lesson_page_given_empty_release_expect_renders_empty_state', () => {
    render(<LessonPage lessons={[]} />);

    expect(screen.getByText(/no lessons yet/i)).toBeInTheDocument();
  });
});
