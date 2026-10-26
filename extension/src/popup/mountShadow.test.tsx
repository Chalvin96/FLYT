import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResolveResponse } from '../lib/resolve-types';
import { createTestShadowSurface } from '../test/shadowSurface';
import { popupImportPage, resetOverlay } from './overlay';
import { mountPopup } from './mountShadow';

vi.mock('@flyt/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@flyt/ui')>()),
  createShadowSurface: () => createTestShadowSurface(),
}));

vi.mock('./Popup', () => ({
  Popup: ({
    state,
    sessionId,
    onClose,
  }: {
    state: { kind: string };
    sessionId: number;
    onClose?: () => void;
  }) => (
    <div data-testid="popup" data-kind={state.kind} data-session={sessionId}>
      <button type="button" onClick={() => onClose?.()}>
        close
      </button>
    </div>
  ),
}));

const onImportPage = vi.fn();

const ANCHOR_RECT = new DOMRect(40, 10, 20, 20);

function container(): HTMLElement {
  return document.body.firstElementChild as HTMLElement;
}

function popup(): HTMLElement | null {
  return document.querySelector('[data-testid="popup"]');
}

beforeEach(() => {
  resetOverlay();
});

describe('mountPopup', () => {
  it('test_mount_popup_given_show_loading_expect_mounted_and_rendered', () => {
    const handle = mountPopup(onImportPage);

    act(() => handle.showLoading('sjø', ANCHOR_RECT));

    expect(popup()?.dataset.kind).toBe('loading');
    expect(container().isConnected).toBe(true);
  });

  it('test_mount_popup_given_open_expect_the_panel_mounted_in_the_surface_portal', () => {
    const handle = mountPopup(onImportPage);

    act(() => handle.showLoading('sjø', ANCHOR_RECT));

    expect(popup()?.closest('[data-testid="portal-surface"]')).not.toBeNull();
  });

  it('test_mount_popup_given_result_expect_result_state_rendered', () => {
    const handle = mountPopup(onImportPage);
    const res: ResolveResponse = { query: 'sjø', candidates: [] };

    act(() => handle.showResult(res, ANCHOR_RECT));

    expect(popup()?.dataset.kind).toBe('result');
  });

  it('test_mount_popup_given_hide_expect_the_panel_gone_and_the_overlay_kept', () => {
    const handle = mountPopup(onImportPage);
    act(() => handle.showSignIn(ANCHOR_RECT));

    act(() => handle.hide());

    expect(popup()).toBeNull();
    expect(container().isConnected).toBe(true);
  });

  it('test_mount_popup_given_close_expect_hidden', () => {
    const handle = mountPopup(onImportPage);
    act(() => handle.showError(ANCHOR_RECT));

    act(() =>
      popup()
        ?.querySelector('button')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    );

    expect(popup()).toBeNull();
  });

  it('test_mount_popup_given_reopen_from_hidden_expect_new_session_id', () => {
    // The session id keys the import button, so an in-flight import survives
    // loading -> result but not a reopen.
    const handle = mountPopup(onImportPage);

    act(() => handle.showLoading('sjø', ANCHOR_RECT));
    const first = popup()?.dataset.session;
    act(() =>
      handle.showResult({ query: 'sjø', candidates: [] }, ANCHOR_RECT),
    );
    expect(popup()?.dataset.session).toBe(first);

    act(() => handle.hide());
    act(() => handle.showLoading('bok', ANCHOR_RECT));

    expect(popup()?.dataset.session).not.toBe(first);
  });

  it('test_mount_popup_given_a_second_handle_expect_its_own_import_callback', async () => {
    const firstImport = vi.fn();
    const secondImport = vi.fn();
    const first = mountPopup(firstImport);
    const second = mountPopup(secondImport);

    act(() => first.showLoading('bok', ANCHOR_RECT));
    act(() => second.showLoading('bok', ANCHOR_RECT));
    await popupImportPage();

    expect(secondImport).toHaveBeenCalledTimes(1);
    expect(firstImport).not.toHaveBeenCalled();
  });
});
