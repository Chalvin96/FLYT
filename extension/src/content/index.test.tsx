import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TAB_CMD } from '../lib/messages';
import { resetOverlay } from '../popup/overlay';
import { createTestShadowSurface } from '../test/shadowSurface';

vi.mock('@flyt/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@flyt/ui')>()),
  createShadowSurface: () => createTestShadowSurface(),
}));

Range.prototype.getBoundingClientRect = () => new DOMRect(10, 10, 20, 20);

await import('./index');
const onMessage = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0]?.[0];

beforeEach(() => vi.clearAllMocks());
afterEach(() => act(() => resetOverlay()));

describe('content lookup', () => {
  it('test_lookup_given_permission_error_expect_toolbar_instructions_without_sign_in', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(async () => ({
      ok: false,
      error: 'permission',
    }));

    await act(async () => {
      onMessage?.({ kind: TAB_CMD.SHOW_FOR, word: 'sjø' }, {}, vi.fn());
    });

    expect(
      await screen.findByText(
        'Click the FlytLese toolbar button to allow access to Flyt.',
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Sign in to Flyt' }),
    ).not.toBeInTheDocument();
  });

  it('test_lookup_given_unauthorized_error_expect_sign_in', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(async () => ({
      ok: false,
      error: 'unauthorized',
    }));

    await act(async () => {
      onMessage?.({ kind: TAB_CMD.SHOW_FOR, word: 'sjø' }, {}, vi.fn());
    });

    expect(
      await screen.findByRole('button', { name: 'Sign in to Flyt' }),
    ).toBeVisible();
  });
});
