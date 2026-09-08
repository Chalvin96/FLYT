import { describe, expect, it } from 'vitest';

import { buildLessonHero } from './buildLessonHero';

const target = {
  lessonId: 42,
  lessonTitle: 'Personal Pronouns',
  goal: 'Learn how to refer to yourself and others',
  familyId: 'personal_pronouns',
  cefrLevel: 'A1',
  inProgress: false,
};

describe('buildLessonHero', () => {
  it('builds next-not-started mode with progress metadata and no chip', () => {
    const hero = buildLessonHero({
      mode: 'next',
      target: { ...target, inProgress: false },
      completedCount: 2,
      totalCount: 4,
    });

    expect(hero.badge).toBe('Up next');
    expect(hero.title).toBe('Personal Pronouns');
    expect(hero.chip).toBeUndefined();
    expect(hero.progress).toMatchObject({
      current: 2,
      total: 4,
      showBar: true,
      showPercentage: true,
    });
  });

  it('builds review-first mode with completion title and no chip', () => {
    const hero = buildLessonHero({
      mode: 'review-first',
      target,
      completedCount: 4,
      totalCount: 4,
    });

    expect(hero.label).toBe('All done');
    expect(hero.title).toBe('All lessons completed!');
    expect(hero.chip).toBeUndefined();
  });

  it('exposes a clock + ~N min chip when the target carries an estimated time', () => {
    const hero = buildLessonHero({
      mode: 'next',
      target: { ...target, estimatedMinutes: 7 },
      completedCount: 0,
      totalCount: 4,
    });

    expect(hero.chip).toBeDefined();
    expect(hero.chip?.label).toBe('~7 min');
    expect(hero.chip?.icon).toBeDefined();
  });
});
