import { describe, expect, it } from 'vitest';

import { importErrorMessage } from './importMessage';

describe('importErrorMessage', () => {
  it.each(['too-large', 'invalid-page'] as const)(
    'test_import_message_given_backend_input_failure_message_expect_backend_copy',
    (error) => {
      expect(
        importErrorMessage({
          ok: false,
          error,
          message: 'This page cannot be imported.',
        }),
      ).toBe('This page cannot be imported.');
    },
  );

  it('test_import_message_given_permission_error_expect_toolbar_instructions', () => {
    expect(importErrorMessage({ ok: false, error: 'permission' })).toBe(
      'Click the FlytLese toolbar button to allow access to Flyt.',
    );
  });

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
