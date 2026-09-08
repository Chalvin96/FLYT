import { afterEach, describe, expect, it, vi } from 'vitest';

import { mountSelectionIcon } from './selectionIcon';

vi.mock('../popup/shadowHost', () => ({
  createShadowHost: () => {
    const container = document.createElement('div');
    const reactHost = document.createElement('div');
    container.append(reactHost);
    return { container, reactHost };
  },
}));

function rectAt(top: number, bottom: number, right = 120): DOMRect {
  return { top, bottom, right } as DOMRect;
}

function container(): HTMLElement {
  return document.body.firstElementChild as HTMLElement;
}

function button(): HTMLButtonElement | null {
  return document.querySelector('button');
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('mountSelectionIcon', () => {
  it('test_selection_icon_given_show_expect_positioned_after_the_selection', () => {
    const icon = mountSelectionIcon();

    icon.show(rectAt(100, 118), vi.fn());

    expect(container().style.display).toBe('block');
    expect(container().style.top).toBe('124px');
    expect(container().style.left).toBe('126px');
  });

  it('test_selection_icon_given_selection_near_viewport_bottom_expect_flipped_above', () => {
    const icon = mountSelectionIcon();

    // window.innerHeight is 768 in jsdom.
    icon.show(rectAt(740, 800), vi.fn());

    expect(container().style.top).toBe('706px');
  });

  it('test_selection_icon_given_hide_expect_not_displayed', () => {
    const icon = mountSelectionIcon();
    icon.show(rectAt(10, 30), vi.fn());

    icon.hide();

    expect(container().style.display).toBe('none');
  });

  it('test_selection_icon_given_activation_expect_callback_with_no_page_navigation', () => {
    const onActivate = vi.fn();
    const icon = mountSelectionIcon();
    icon.show(rectAt(10, 30), onActivate);

    button()?.click();

    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('test_selection_icon_given_pointerdown_expect_selection_not_dropped', () => {
    const icon = mountSelectionIcon();
    icon.show(rectAt(10, 30), vi.fn());

    const event = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });
    button()?.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('test_selection_icon_given_button_expect_accessible_name', () => {
    const icon = mountSelectionIcon();
    icon.show(rectAt(10, 30), vi.fn());

    expect(button()?.getAttribute('aria-label')).toBe('Look up with Flyt');
    expect(button()?.type).toBe('button');
  });
});
