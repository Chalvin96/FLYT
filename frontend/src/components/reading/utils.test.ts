import { describe, expect, it } from 'vitest';

import {
  getReaderEllipsisTarget,
  getReaderPaginationItems,
  parseReaderPage,
} from './utils';

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

describe('getReaderPaginationItems', () => {
  it('test_pagination_items_given_short_story_expect_every_page', () => {
    expect(getReaderPaginationItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getReaderPaginationItems(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('test_pagination_items_given_page_near_start_expect_trailing_ellipsis', () => {
    expect(getReaderPaginationItems(3, 12)).toEqual([
      1,
      2,
      3,
      4,
      5,
      'ellipsis-end',
      12,
    ]);
  });

  it('test_pagination_items_given_middle_page_expect_both_ellipses', () => {
    expect(getReaderPaginationItems(6, 12)).toEqual([
      1,
      'ellipsis-start',
      5,
      6,
      7,
      'ellipsis-end',
      12,
    ]);
  });

  it('test_pagination_items_given_page_near_end_expect_leading_ellipsis', () => {
    expect(getReaderPaginationItems(11, 12)).toEqual([
      1,
      'ellipsis-start',
      8,
      9,
      10,
      11,
      12,
    ]);
  });

  it('test_pagination_items_given_any_window_expect_current_page_present', () => {
    for (let page = 1; page <= 12; page += 1) {
      expect(getReaderPaginationItems(page, 12)).toContain(page);
    }
  });
});

describe('getReaderEllipsisTarget', () => {
  it('test_ellipsis_target_given_middle_page_expect_three_page_jump', () => {
    expect(getReaderEllipsisTarget('ellipsis-end', 5, 12)).toBe(8);
    expect(getReaderEllipsisTarget('ellipsis-start', 8, 12)).toBe(5);
  });

  it('test_ellipsis_target_given_near_edge_expect_clamped_to_story', () => {
    expect(getReaderEllipsisTarget('ellipsis-start', 2, 12)).toBe(1);
    expect(getReaderEllipsisTarget('ellipsis-end', 11, 12)).toBe(12);
  });
});
