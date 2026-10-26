import { describe, expect, it } from 'vitest';

import {
  formatReadingMinutes,
  formatReadingMinutesPhrase,
} from './readingDisplay';

describe('Reading duration', () => {
  it.each([
    { minutes: 1, duration: '1 min' },
    { minutes: 59, duration: '59 min' },
    { minutes: 60, duration: '1 h' },
    { minutes: 72, duration: '1 h 12 min' },
  ])(
    'test_reading_duration_given_minutes_expect_short_reading_time',
    ({ minutes, duration }) => {
      expect(formatReadingMinutes(minutes)).toBe(duration);
    },
  );

  it.each([
    { minutes: 1, phrase: 'under a minute' },
    { minutes: 7, phrase: '7 minutes' },
    { minutes: 8667, phrase: '8,667 minutes' },
  ])(
    'test_reading_duration_phrase_given_minutes_expect_spelled_out_reading_time',
    ({ minutes, phrase }) => {
      expect(formatReadingMinutesPhrase(minutes)).toBe(phrase);
    },
  );
});
