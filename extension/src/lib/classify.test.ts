import { describe, expect, it } from 'vitest';

import { ApiError } from './api';
import { classify } from './classify';

describe('classify', () => {
  it('test_classify_given_known_code_expect_code_wins_over_status', () => {
    // A 422 whose code is a mapped one must NOT fall into the generic 422
    // "invalid-page" branch — the code decides.
    expect(classify(new ApiError(422, 'x', 'IMPORT_TOO_LARGE'))).toEqual({
      ok: false,
      error: 'too-large',
    });
    expect(classify(new ApiError(429, 'x', 'IMPORT_QUOTA_EXCEEDED'))).toEqual({
      ok: false,
      error: 'quota-reached',
    });
    expect(
      classify(new ApiError(422, 'x', 'IMPORT_INVALID_SOURCE_URL')),
    ).toEqual({ ok: false, error: 'invalid-page' });
    expect(classify(new ApiError(422, 'x', 'IMPORT_EMPTY'))).toEqual({
      ok: false,
      error: 'invalid-page',
    });
    expect(classify(new ApiError(404, 'x', 'IMPORT_NOT_FOUND'))).toEqual({
      ok: false,
      error: 'unknown',
    });
  });

  it('test_classify_given_no_known_code_expect_status_fallback', () => {
    expect(classify(new ApiError(401))).toEqual({
      ok: false,
      error: 'unauthorized',
    });
    expect(classify(new ApiError(413))).toEqual({
      ok: false,
      error: 'too-large',
    });
    expect(classify(new ApiError(422))).toEqual({
      ok: false,
      error: 'invalid-page',
    });
    expect(classify(new ApiError(429))).toEqual({
      ok: false,
      error: 'quota-reached',
    });
    // A bare 5xx is a server error, not a connection problem.
    expect(classify(new ApiError(500))).toEqual({
      ok: false,
      error: 'unknown',
    });
  });

  it('test_classify_given_non_api_error_expect_network', () => {
    // A thrown fetch (not an ApiError) is the real network failure.
    expect(classify(new Error('boom'))).toEqual({ ok: false, error: 'network' });
    expect(classify('nope')).toEqual({ ok: false, error: 'network' });
  });
});
