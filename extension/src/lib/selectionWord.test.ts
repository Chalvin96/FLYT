import { describe, expect, it } from 'vitest';

import { selectionWord } from './selectionWord';

describe('selectionWord', () => {
  it('test_selection_word_given_single_word_expect_word', () => {
    expect(selectionWord('kjærlighet')).toBe('kjærlighet');
    expect(selectionWord('  øve\n')).toBe('øve');
    expect(selectionWord('å')).toBe('å');
    expect(selectionWord('«bok,»')).toBe('bok');
    expect(selectionWord("can't")).toBe("can't");
    expect(selectionWord('lærer’n')).toBe('lærer’n');
    expect(selectionWord('e-post')).toBe('e-post');
  });

  it('test_selection_word_given_multiple_words_expect_null', () => {
    expect(selectionWord('to ord')).toBeNull();
    expect(selectionWord('en\nlinje til')).toBeNull();
  });

  it('test_selection_word_given_non_word_characters_expect_null', () => {
    expect(selectionWord('!')).toBeNull();
    expect(selectionWord('h3i')).toBeNull();
    expect(selectionWord('123')).toBeNull();
  });

  it('test_selection_word_given_out_of_range_length_expect_null', () => {
    expect(selectionWord('a')).toBe('a');
    expect(selectionWord('a'.repeat(41))).toBeNull();
    expect(selectionWord('a'.repeat(40))).toBe('a'.repeat(40));
  });

  it('test_selection_word_given_empty_selection_expect_null', () => {
    expect(selectionWord('')).toBeNull();
    expect(selectionWord('   ')).toBeNull();
  });
});
