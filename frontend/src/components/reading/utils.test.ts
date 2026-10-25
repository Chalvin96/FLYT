import { describe, expect, it } from 'vitest';

import { parseReaderPage } from './utils';

describe('parseReaderPage', () => {
  it('test_parse_reader_page_given_positive_whole_number_expect_that_page', () => {
    expect(parseReaderPage(3)).toBe(3);
    expect(parseReaderPage('3')).toBe(3);
  });

  it('test_parse_reader_page_given_unusable_value_expect_undefined', () => {
    for (const value of [
      'abc',
      '',
      '2.5',
      2.5,
      0,
      -2,
      null,
      undefined,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      ['2'],
    ]) {
      expect(parseReaderPage(value)).toBeUndefined();
    }
  });
});
