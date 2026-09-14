import { describe, expect, it } from 'vitest';

import {
  formatLookupLabel,
  hasValidNorwegianChars,
  normalizeLookupQuery,
  posLabel,
} from './grammar';

describe('lookup grammar', () => {
  it('test_lookup_query_given_expression_spacing_expect_normalized_punctuation_preserved', () => {
    expect(normalizeLookupQuery('  få   [stelle|lage] i stand  ')).toBe(
      'få [stelle|lage] i stand',
    );
    expect(hasValidNorwegianChars('du store min!')).toBe(true);
  });

  it('test_lookup_query_given_length_boundary_expect_80_allowed_and_81_rejected', () => {
    expect(hasValidNorwegianChars('a'.repeat(80))).toBe(true);
    expect(hasValidNorwegianChars('a'.repeat(81))).toBe(false);
  });

  it('test_lookup_query_given_decomposed_value_expect_limit_after_nfc', () => {
    const canonical = 'é'.repeat(80);
    const decomposed = 'e\u0301'.repeat(80);

    expect(decomposed.length).toBe(160);
    expect(normalizeLookupQuery(decomposed)).toBe(canonical);
    expect(hasValidNorwegianChars(decomposed)).toBe(true);
  });

  it('test_lookup_query_given_unsafe_characters_expect_rejected', () => {
    expect(hasValidNorwegianChars('foo%')).toBe(false);
    expect(hasValidNorwegianChars('foo_bar')).toBe(false);
    expect(hasValidNorwegianChars('<b>foo</b>')).toBe(false);
    expect(hasValidNorwegianChars('foo\nbar')).toBe(false);
  });

  it('test_lookup_label_given_bracket_alternatives_expect_readable_display_and_canonical_value', () => {
    const canonical = 'få [stelle|lage] i stand';
    expect(formatLookupLabel(canonical)).toBe('få i stand');
    expect(normalizeLookupQuery(canonical)).toBe(canonical);
  });

  it('test_pos_label_given_expression_expect_uppercase_badge_code', () => {
    expect(posLabel('expression')).toBe('Expression');
  });
});
