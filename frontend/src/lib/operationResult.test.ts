import { describe, expect, it } from 'vitest';

import {
  ratingFromResult,
  revealRating,
  type OperationResult,
} from './operationResult';

describe('ratingFromResult', () => {
  it('maps correct to easy', () => {
    const result: OperationResult = { correct: true };
    expect(ratingFromResult(result)).toBe(4);
  });

  it('maps incorrect to again', () => {
    expect(ratingFromResult({ correct: false })).toBe(1);
  });

  it('honors an explicit rating', () => {
    expect(ratingFromResult({ correct: true, rating: 4 })).toBe(4);
  });

  it.each([0, 4.5])('rejects an invalid explicit rating (%s)', (rating) => {
    expect(() => ratingFromResult({ correct: true, rating })).toThrow(
      `Invalid rating: ${rating}`,
    );
  });
});

describe('revealRating', () => {
  it('returns Hard (2) when fraction is exactly 0.5', () => {
    expect(revealRating(0.5)).toBe(2);
  });

  it('returns Hard (2) when fraction is above 0.5', () => {
    expect(revealRating(0.75)).toBe(2);
    expect(revealRating(1)).toBe(2);
  });

  it('returns Again (1) when fraction is below 0.5', () => {
    expect(revealRating(0)).toBe(1);
    expect(revealRating(0.49)).toBe(1);
  });
});
