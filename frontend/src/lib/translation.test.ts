import { describe, expect, it } from 'vitest';

import { splitTranslation } from './translation';

describe('splitTranslation', () => {
  it('returns null for null, undefined, empty, or whitespace-only input', () => {
    expect(splitTranslation(null)).toBeNull();
    expect(splitTranslation(undefined)).toBeNull();
    expect(splitTranslation('')).toBeNull();
    expect(splitTranslation('   ')).toBeNull();
    expect(splitTranslation('\t\n')).toBeNull();
  });

  it('returns primary with empty alternates for a single term', () => {
    expect(splitTranslation('house')).toEqual({
      primary: 'house',
      alternates: [],
    });
  });

  it('splits "house / household / family" into primary and alternates', () => {
    expect(splitTranslation('house / household / family')).toEqual({
      primary: 'house',
      alternates: ['household', 'family'],
    });
  });

  it('caps alternates at 3 and drops the tail silently', () => {
    expect(splitTranslation('a / b / c / d / e / f')).toEqual({
      primary: 'a',
      alternates: ['b', 'c', 'd'],
    });
  });

  it('trims extra whitespace around separators and parts', () => {
    expect(splitTranslation('  house  /   household  ')).toEqual({
      primary: 'house',
      alternates: ['household'],
    });
  });

  it('drops empty segments', () => {
    expect(splitTranslation('a /  / b')).toEqual({
      primary: 'a',
      alternates: ['b'],
    });
  });

  it('does NOT split on a bare slash (preserves he/she, km/h)', () => {
    // ' / ' convention only — a no-space slash is part of the gloss, not a
    // sense boundary. Documents the intentional graceful no-op.
    expect(splitTranslation('he/she')).toEqual({
      primary: 'he/she',
      alternates: [],
    });
    expect(splitTranslation('bleat/pour')).toEqual({
      primary: 'bleat/pour',
      alternates: [],
    });
  });
});
