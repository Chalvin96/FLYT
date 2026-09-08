import { describe, expect, it } from 'vitest';

import { isWord } from './word';

describe('isWord', () => {
  it('test_is_word_given_norwegian_letters_expect_true', () => {
    expect(isWord('kjærlighet')).toBe(true);
    expect(isWord('øve')).toBe(true);
    expect(isWord('Åpen')).toBe(true);
    expect(isWord('sjø-mat')).toBe(true);
  });

  it('test_is_word_given_length_boundaries_expect_validity', () => {
    expect(isWord('a')).toBe(true);
    expect(isWord('a'.repeat(41))).toBe(false);
    expect(isWord('a'.repeat(40))).toBe(true);
  });

  it('test_is_word_given_non_letters_expect_false', () => {
    expect(isWord('to ord')).toBe(false);
    expect(isWord('hei!')).toBe(false);
    expect(isWord('h3i')).toBe(false);
    expect(isWord('')).toBe(false);
  });
});
