import { describe, expect, it } from 'vitest';

import { toLemmaPos } from './resolve-types';

describe('toLemmaPos', () => {
  it('test_to_lemma_pos_given_known_value_expect_narrowed_union', () => {
    expect(toLemmaPos('noun')).toBe('noun');
    expect(toLemmaPos('unknown')).toBe('unknown');
  });

  it('test_to_lemma_pos_given_schema_drift_expect_undefined', () => {
    // An unrecognized value degrades to "no pos badge" rather than being cast.
    expect(toLemmaPos('particle')).toBeUndefined();
    expect(toLemmaPos('Noun')).toBeUndefined();
    expect(toLemmaPos('')).toBeUndefined();
  });
});
