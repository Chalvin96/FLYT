import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestShadowSurface } from '../test/shadowSurface';
import { resetOverlay } from '../popup/overlay';
import { mountSelectionIcon, type SelectionIconHandle } from './selectionIcon';

vi.mock('@flyt/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@flyt/ui')>()),
  createShadowSurface: () => createTestShadowSurface(),
}));

function rectAt(top: number, bottom: number, right = 120): DOMRect {
  return { top, bottom, right } as DOMRect;
}

function shownIcon(rect: DOMRect, onActivate: () => void): SelectionIconHandle {
  const icon = mountSelectionIcon();
  act(() => icon.show(rect, onActivate));
  return icon;
}

function slot(): HTMLElement {
  return document.body.firstElementChild?.firstElementChild
    ?.firstElementChild as HTMLElement;
}

function button(): HTMLButtonElement | null {
  return document.querySelector('button');
}

beforeEach(() => {
  resetOverlay();
});

describe('mountSelectionIcon', () => {
  it('test_selection_icon_given_show_expect_positioned_after_the_selection', () => {
    shownIcon(rectAt(100, 118), vi.fn());

    expect(slot().hidden).toBe(false);
    expect(slot().style.top).toBe('124px');
    expect(slot().style.left).toBe('126px');
  });

  it('test_selection_icon_given_selection_near_viewport_bottom_expect_flipped_above', () => {
    // window.innerHeight is 768 in jsdom.
    shownIcon(rectAt(740, 800), vi.fn());

    expect(slot().style.top).toBe('702px');
  });

  it('test_selection_icon_given_room_for_the_box_but_not_the_touch_target_expect_flipped_above', () => {
    // 729 + 6 + 32 = 767 fits under 768, but the target reaches 773.
    shownIcon(rectAt(690, 729), vi.fn());

    expect(slot().style.top).toBe('652px');
  });

  it('test_selection_icon_given_hide_expect_not_displayed', () => {
    const icon = shownIcon(rectAt(10, 30), vi.fn());

    act(() => icon.hide());

    expect(slot().hidden).toBe(true);
  });

  it('test_selection_icon_given_activation_expect_callback_with_no_page_navigation', () => {
    const onActivate = vi.fn();
    shownIcon(rectAt(10, 30), onActivate);

    act(() => button()?.click());

    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('test_selection_icon_given_pointerdown_expect_selection_not_dropped', () => {
    shownIcon(rectAt(10, 30), vi.fn());

    const event = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });
    act(() => button()?.dispatchEvent(event));

    expect(event.defaultPrevented).toBe(true);
  });

  it('test_selection_icon_given_button_expect_accessible_name', () => {
    shownIcon(rectAt(10, 30), vi.fn());

    expect(button()?.getAttribute('aria-label')).toBe('Look up with Flyt');
    expect(button()?.type).toBe('button');
  });
});
