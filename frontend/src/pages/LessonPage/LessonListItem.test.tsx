import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import type { LessonSummaryRead } from '@/types/api';

import { LessonListItem } from './LessonListItem';
import { getLessonStateMeta } from './LessonStateMeta';

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
  overrides: Partial<LessonSummaryRead> = {},
): LessonSummaryRead {
  return {
    id: 1,
    source_id: 'greetings',
    kind: 'grammar',
    family_id: 'basics',
    title: 'Greetings',
    cefr_level: 'A1',
    goal: 'Hei og hallo',
    order: 1,
    state: 'not_started',
    estimated_minutes: 2,
    last_activity_at: null,
    ...overrides,
  };
}

describe('getLessonStateMeta', () => {
  it('maps NOT_STARTED to the neutral gray token classes', () => {
    const meta = getLessonStateMeta('not_started');

    expect(meta.toneClassName).toBe('bg-black-10 text-black-50');
  });

  it('keeps COMPLETED and IN_PROGRESS on-brand tones', () => {
    expect(getLessonStateMeta('completed').toneClassName).toBe(
      'bg-secondary-20 text-secondary-90',
    );
    expect(getLessonStateMeta('in_progress').toneClassName).toBe(
      'bg-primary-20 text-primary-90',
    );
  });
});

describe('LessonListItem', () => {
  it('renders the estimated time with the clock icon', () => {
    render(<LessonListItem lesson={makeLesson({ estimated_minutes: 2 })} />);

    expect(screen.getByText('~2 min')).toBeInTheDocument();
  });
});
