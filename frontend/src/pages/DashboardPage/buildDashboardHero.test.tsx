import { describe, expect, it } from 'vitest';

import { buildDashboardHero } from './buildDashboardHero';

describe('buildDashboardHero', () => {
  it('builds review state content with estimated session time', () => {
    const hero = buildDashboardHero({
      state: 'review',
      dueCount: 10,
      streak: 3,
      lessonsHref: '/lesson',
      reviewHref: '/review',
    });

    expect(hero.title).toBe('Your review queue');
    expect(hero.subtitle).toBe('10 cards · ~3 min session');
    expect(hero.chip).toBeUndefined();
  });

  it('builds done state with streak chip when streak is present', () => {
    const hero = buildDashboardHero({
      state: 'done',
      dueCount: 0,
      streak: 5,
      lessonsHref: '/lesson',
      reviewHref: '/review',
    });

    expect(hero.title).toBe("You're all caught up");
    expect(hero.chip?.label).toBe('5-day streak');
  });
});
