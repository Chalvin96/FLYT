import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppNavbarPreview } from '@/components/router/AppNavbar/AppNavbarPreview';

import { LessonHero } from './LessonHero';

const target = {
  lessonId: 42,
  lessonTitle: 'Personal Pronouns',
  goal: 'Learn how to refer to yourself and others',
  familyId: 'personal_pronouns',
  cefrLevel: 'A1',
  inProgress: false,
};

describe('LessonHero', () => {
  it('renders next-not-started mode without lesson count chip and with start CTA', async () => {
    render(
      <AppNavbarPreview>
        <LessonHero
          mode="next"
          target={{ ...target, inProgress: false }}
          completedCount={1}
          totalCount={4}
        />
      </AppNavbarPreview>,
    );

    expect(await screen.findByText('Up next')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Personal Pronouns' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Start this lesson' }),
    ).toHaveAttribute('href', '/lesson/42');
    expect(screen.queryByText('1 of 4 lessons')).not.toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: 'Lesson progress' }),
    ).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('renders next-in-progress mode without lesson count chip and with continue CTA', async () => {
    render(
      <AppNavbarPreview>
        <LessonHero
          mode="next"
          target={{ ...target, inProgress: true }}
          completedCount={2}
          totalCount={4}
        />
      </AppNavbarPreview>,
    );

    expect(await screen.findByText('In progress')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Continue lesson' }),
    ).toHaveAttribute('href', '/lesson/42');
    expect(screen.queryByText('2 of 4 lessons')).not.toBeInTheDocument();
  });

  it('test_lesson_hero_given_review_first_mode_and_missing_goal_expect_hides_count_chip', async () => {
    render(
      <AppNavbarPreview>
        <LessonHero
          mode="review-first"
          target={{ ...target, goal: null }}
          completedCount={4}
          totalCount={4}
        />
      </AppNavbarPreview>,
    );

    expect(
      await screen.findByText('All lessons completed!'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Review first lesson' }),
    ).toHaveAttribute('href', '/lesson/42');
    expect(screen.queryByText('4 of 4 lessons')).not.toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
