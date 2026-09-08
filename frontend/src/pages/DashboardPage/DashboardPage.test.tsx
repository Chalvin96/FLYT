import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DashboardPage } from './DashboardPage';

vi.mock('./DashboardHero', () => ({
  DashboardHero: ({
    dueCount,
    streak,
  }: {
    dueCount: number;
    streak: number;
  }) => <div>{`hero:${dueCount}:${streak}`}</div>,
}));

vi.mock('./DashboardPracticeCards', () => ({
  DashboardPracticeCards: ({
    dueCount,
    lessonCount,
    lessonsRemaining,
  }: {
    dueCount: number;
    lessonCount: number;
    lessonsRemaining: boolean;
  }) => <div>{`practice:${dueCount}:${lessonCount}:${lessonsRemaining}`}</div>,
}));

vi.mock('./DashboardStats', () => ({
  DashboardStats: ({
    dueCount,
    dueNew,
  }: {
    dueCount: number;
    dueNew: number;
  }) => <div>{`stats:${dueCount}:${dueNew}`}</div>,
}));

vi.mock('./DashboardSnapshot', () => ({
  DashboardSnapshot: () => <div>snapshot</div>,
}));

describe('DashboardPage', () => {
  it('renders dashboard metrics from stats prop', () => {
    render(
      <DashboardPage
        stats={{
          dueCount: 5,
          dueNew: 2,
          lessonCount: 4,
          new: 1,
          learning: 2,
          relearning: 0,
          accuracy7d: 0.91,
          wordsPracticed: 99,
          streak: 6,
          snapshot: {
            this_week: [1, 1, 1, 1, 1, 1, 1],
            last_week: [0, 0, 0, 0, 0, 0, 0],
            two_weeks_ago: [0, 0, 0, 0, 0, 0, 0],
            three_weeks_ago: [0, 0, 0, 0, 0, 0, 0],
          },
        }}
      />,
    );

    expect(screen.getByText('hero:5:6')).toBeInTheDocument();
    expect(screen.getByText('stats:5:2')).toBeInTheDocument();
    expect(screen.getByText('practice:5:4:true')).toBeInTheDocument();
  });

  it('derives lessonsRemaining from stats only', () => {
    const legacyOverride: Record<string, unknown> = { hasLessons: true };

    render(
      <DashboardPage
        {...legacyOverride}
        stats={{
          dueCount: 0,
          dueNew: 0,
          lessonCount: 0,
          new: 0,
          learning: 0,
          relearning: 0,
          accuracy7d: null,
          wordsPracticed: 0,
          streak: 0,
          snapshot: {
            this_week: [0, 0, 0, 0, 0, 0, 0],
            last_week: [0, 0, 0, 0, 0, 0, 0],
            two_weeks_ago: [0, 0, 0, 0, 0, 0, 0],
            three_weeks_ago: [0, 0, 0, 0, 0, 0, 0],
          },
        }}
      />,
    );

    expect(screen.getByText('practice:0:0:false')).toBeInTheDocument();
  });

  it('ignores legacy dueCount override when stats are null', () => {
    const legacyOverride: Record<string, unknown> = { dueCount: 9 };

    render(<DashboardPage {...legacyOverride} stats={null} />);

    expect(screen.getByText('hero:0:0')).toBeInTheDocument();
    expect(screen.getByText('stats:0:0')).toBeInTheDocument();
    expect(screen.getByText('practice:0:0:false')).toBeInTheDocument();
  });
});
