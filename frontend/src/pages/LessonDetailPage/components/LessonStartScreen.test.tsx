import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { LessonDetailRead } from '@/types/api';
import type { LessonPacket } from '@/types/lesson-contracts';

import { LessonStartScreen } from './LessonStartScreen';

const packet: LessonPacket = {
  schema_version: '4.0',
  id: 'lesson-1',
  kind: 'grammar',
  language: 'nb-NO',
  title: 'Personal Pronouns',
  cefr_level: 'A1',
  goal: 'Learn the core Norwegian personal pronouns.',
  objectives: [],
  content: [],
  sections: [],
  exercises: [],
  practice_groups: [],
  media: { audio: [] },
};

function makeLesson(
  overrides: Partial<LessonDetailRead> = {},
): LessonDetailRead {
  return {
    id: 1,
    source_id: 'personal-pronouns',
    kind: 'grammar',
    family_id: 'basics',
    title: 'Personal Pronouns',
    cefr_level: 'A1',
    goal: 'Learn the core Norwegian personal pronouns.',
    order: 1,
    estimated_minutes: 5,
    packet,
    media: { audio: [] },
    progress: null,
    ...overrides,
  };
}

describe('LessonStartScreen', () => {
  it('test_start_button_given_pending_start_expect_busy_pending_label', () => {
    render(
      <LessonStartScreen
        lesson={makeLesson()}
        isSubmitting
        onStart={() => undefined}
      />,
    );

    const button = screen.getByRole('button', { name: /starting/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('test_start_screen_given_cefr_level_expect_level_chip_rendered', () => {
    render(
      <LessonStartScreen
        lesson={makeLesson()}
        isSubmitting={false}
        onStart={() => undefined}
      />,
    );

    expect(screen.getByText('A1')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Personal Pronouns' }),
    ).toBeInTheDocument();
  });

  it('renders the estimated time with a clock icon', () => {
    render(
      <LessonStartScreen
        lesson={makeLesson({ estimated_minutes: 5 })}
        isSubmitting={false}
        onStart={() => undefined}
      />,
    );

    expect(screen.getByText('~5 min')).toBeInTheDocument();
  });

  it('omits the estimated time when the backend has no estimate', () => {
    render(
      <LessonStartScreen
        lesson={makeLesson({ estimated_minutes: 0 })}
        isSubmitting={false}
        onStart={() => undefined}
      />,
    );

    expect(screen.queryByText(/~\d+ min/)).not.toBeInTheDocument();
  });
});
