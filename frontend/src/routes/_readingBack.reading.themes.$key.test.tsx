import { describe, expect, it } from 'vitest';

import { Route } from './_readingBack.reading.themes.$key';

const validateSearch = Route.options.validateSearch;
if (typeof validateSearch !== 'function') {
  throw new Error('Theme search validator must be a function.');
}

describe('reading theme search', () => {
  it('test_theme_search_given_cefr_levels_expect_valid_deduplicated_filter', () => {
    expect(
      validateSearch({
        levels: ['A2', 'not-a-level', 'A2', 'C1'],
      }),
    ).toEqual({ levels: ['A2', 'C1'] });
  });

  it('test_theme_search_given_missing_or_invalid_level_array_expect_no_level_filter', () => {
    for (const levels of [undefined, null, 'A2', 12]) {
      expect(validateSearch({ levels })).toEqual({
        levels: undefined,
      });
    }
  });
});
