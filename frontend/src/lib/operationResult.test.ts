import { describe, expect, it } from 'vitest';

import { ratingFromResult, type OperationResult } from './operationResult';

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
