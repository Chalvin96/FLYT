import { afterEach, expect, it, vi } from 'vitest';

import { secondsRemaining } from './chatGPTLinkCardFormat';

afterEach(() => {
  vi.useRealTimers();
});

it('test_seconds_remaining_given_server_utc_expiry_expect_fresh_code_duration', () => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 9, 25, 12, 0, 0));

  expect(secondsRemaining('2026-10-25T12:10:00Z')).toBe(600);
});
