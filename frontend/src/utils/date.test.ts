import { describe, expect, it } from 'vitest';

import { formatReadingPublishedShortDate } from '@/components/reading/readingDisplay';

import { parseUtcTimestamp } from './date';

describe('UTC API timestamps', () => {
  it('test_parse_utc_timestamp_given_utc_suffix_expect_utc_instant', () => {
    expect(parseUtcTimestamp('2026-10-03T23:59:59Z')).toBe(
      Date.UTC(2026, 9, 3, 23, 59, 59),
    );
  });

  it('test_parse_utc_timestamp_given_offset_free_value_expect_utc_instant', () => {
    expect(parseUtcTimestamp('2026-10-03T23:59:59')).toBe(
      Date.UTC(2026, 9, 3, 23, 59, 59),
    );
  });

  it('test_parse_utc_timestamp_given_explicit_offset_expect_same_instant', () => {
    expect(parseUtcTimestamp('2026-10-04T01:59:59+02:00')).toBe(
      Date.UTC(2026, 9, 3, 23, 59, 59),
    );
  });

  it('test_calendar_labels_given_utc_timestamp_expect_utc_day', () => {
    const timestamp = '2026-10-03T23:59:59';

    expect(formatReadingPublishedShortDate(timestamp)).toBe('3 Oct');
  });
});
