import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ResolveResponse } from '../lib/resolve-types';
import { mountPopup } from './mountShadow';

vi.mock('./shadowHost', () => ({
  createShadowHost: () => {
    const container = document.createElement('div');
    const reactHost = document.createElement('div');
    container.append(reactHost);
    return { container, reactHost };
  },
}));

vi.mock('./Popup', () => ({
  Popup: ({ state, sessionId }: { state: { kind: string }; sessionId: number }) => (
    <div data-testid="popup" data-kind={state.kind} data-session={sessionId} />
  ),
}));

const onImportPage = vi.fn();

function rectAt(top: number, bottom: number, left = 40): DOMRect {
  return { top, bottom, left } as DOMRect;
}

function container(): HTMLElement {
  return document.body.firstElementChild as HTMLElement;
}

function popup(): HTMLElement | null {
  return document.querySelector('[data-testid="popup"]');
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('mountPopup', () => {
  it('test_mount_popup_given_show_loading_expect_mounted_and_positioned_below', () => {
    const handle = mountPopup(onImportPage);

    handle.showLoading('sjø', rectAt(100, 120));

    expect(popup()?.dataset.kind).toBe('loading');
    expect(container().style.display).toBe('block');
    // No measurable height in jsdom, so the below-the-selection branch applies.
    expect(container().style.top).toBe('126px');
    expect(container().style.left).toBe('40px');
  });

  it('test_mount_popup_given_selection_near_viewport_bottom_expect_flipped_above', () => {
    const handle = mountPopup(onImportPage);

    handle.showLoading('sjø', rectAt(700, 800));

    // window.innerHeight is 768 in jsdom; 800 + 6 exceeds it, so flip above.
    expect(container().style.top).toBe('694px');
  });

  it('test_mount_popup_given_result_expect_result_state_rendered', () => {
    const handle = mountPopup(onImportPage);
    const res: ResolveResponse = { query: 'sjø', candidates: [] };

    handle.showResult(res, rectAt(10, 30));

    expect(popup()?.dataset.kind).toBe('result');
  });

  it('test_mount_popup_given_hide_expect_hidden_without_unmounting', () => {
    const handle = mountPopup(onImportPage);
    handle.showSignIn(rectAt(10, 30));

    handle.hide();

    expect(container().style.display).toBe('none');
    expect(popup()?.dataset.kind).toBe('hidden');
  });

  it('test_mount_popup_given_escape_key_expect_hidden', () => {
    const handle = mountPopup(onImportPage);
    handle.showError(rectAt(10, 30));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(container().style.display).toBe('none');
  });

  it('test_mount_popup_given_outside_pointerdown_expect_hidden', () => {
    const handle = mountPopup(onImportPage);
    handle.showError(rectAt(10, 30));

    document.body.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true }),
    );

    expect(container().style.display).toBe('none');
  });

  it('test_mount_popup_given_pointerdown_on_container_expect_still_visible', () => {
    // Shadow-DOM retargeting reports clicks inside the popup as the container.
    const handle = mountPopup(onImportPage);
    handle.showError(rectAt(10, 30));

    container().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

    expect(container().style.display).toBe('block');
  });

  it('test_mount_popup_given_reopen_from_hidden_expect_new_session_id', () => {
    // The session id keys the import button, so an in-flight import survives
    // loading -> result but not a reopen.
    const handle = mountPopup(onImportPage);

    handle.showLoading('sjø', rectAt(10, 30));
    const first = popup()?.dataset.session;
    handle.showResult({ query: 'sjø', candidates: [] }, rectAt(10, 30));
    expect(popup()?.dataset.session).toBe(first);

    handle.hide();
    handle.showLoading('bok', rectAt(10, 30));

    expect(popup()?.dataset.session).not.toBe(first);
  });
});
