import { describe, expect, it } from 'vitest';

import { importErrorMessage } from './importMessage';

describe('importErrorMessage', () => {
  it('test_import_message_given_each_error_kind_expect_distinct_copy', () => {
    expect(importErrorMessage({ ok: false, error: 'too-large' })).toMatch(
      /too large/i,
    );
    expect(importErrorMessage({ ok: false, error: 'invalid-page' })).toMatch(
      /readable text/i,
    );
    expect(importErrorMessage({ ok: false, error: 'quota-reached' })).toMatch(
      /limit reached/i,
    );
    expect(importErrorMessage({ ok: false, error: 'unauthorized' })).toMatch(
      /sign in/i,
    );
  });

  it('test_import_message_given_network_vs_unknown_expect_different_framing', () => {
    // A connection failure and a server error must not read the same.
    const network = importErrorMessage({ ok: false, error: 'network' });
    const unknown = importErrorMessage({ ok: false, error: 'unknown' });
    expect(network).toMatch(/connection/i);
    expect(unknown).not.toMatch(/connection/i);
    expect(network).not.toBe(unknown);
  });
});
