import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { watchSelection } from './selectionListener';

// jsdom implements Range but not its layout geometry.
Range.prototype.getBoundingClientRect = () =>
  ({ top: 10, bottom: 30, right: 120 }) as DOMRect;

const icon = { show: vi.fn(), hide: vi.fn() };
const onLookup = vi.fn();

function selectAll(node: Node): void {
  const range = document.createRange();
  range.selectNodeContents(node);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.dispatchEvent(new Event('selectionchange'));
}

function collapse(): void {
  window.getSelection()?.removeAllRanges();
  document.dispatchEvent(new Event('selectionchange'));
}

let stop: () => void;

beforeEach(() => {
  vi.clearAllMocks();
  stop = watchSelection(icon, onLookup);
});

afterEach(() => {
  stop();
  document.body.innerHTML = '';
});

function paragraph(text: string): HTMLElement {
  const el = document.createElement('p');
  el.textContent = text;
  document.body.append(el);
  return el;
}

describe('watchSelection', () => {
  it('test_watch_selection_given_word_selected_expect_icon_shown', () => {
    selectAll(paragraph('kjærlighet'));

    expect(icon.show).toHaveBeenCalledTimes(1);
    expect(icon.hide).not.toHaveBeenCalled();
  });

  it('test_watch_selection_given_multi_word_selected_expect_icon_hidden', () => {
    selectAll(paragraph('to ord her'));

    expect(icon.show).not.toHaveBeenCalled();
    expect(icon.hide).toHaveBeenCalled();
  });

  it('test_watch_selection_given_selection_collapsed_expect_icon_hidden', () => {
    selectAll(paragraph('kjærlighet'));
    icon.hide.mockClear();

    collapse();

    expect(icon.hide).toHaveBeenCalled();
  });

  it('test_watch_selection_given_editable_host_expect_icon_hidden', () => {
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    editable.textContent = 'kjærlighet';
    document.body.append(editable);

    selectAll(editable);

    expect(icon.show).not.toHaveBeenCalled();
  });

  it('test_watch_selection_given_textarea_selection_expect_icon_hidden', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'kjærlighet';
    document.body.append(textarea);
    textarea.select();
    document.dispatchEvent(new Event('selectionchange'));

    expect(icon.show).not.toHaveBeenCalled();
  });

  it('test_watch_selection_given_escape_pressed_expect_icon_hidden', () => {
    selectAll(paragraph('kjærlighet'));
    icon.hide.mockClear();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(icon.hide).toHaveBeenCalled();
  });

  it('test_watch_selection_given_scroll_expect_icon_hidden', () => {
    selectAll(paragraph('kjærlighet'));
    icon.hide.mockClear();

    window.dispatchEvent(new Event('scroll'));

    expect(icon.hide).toHaveBeenCalled();
  });

  it('test_watch_selection_given_lookup_requested_expect_word_and_rect_forwarded', () => {
    selectAll(paragraph('kjærlighet'));

    const requestLookup = icon.show.mock.calls[0]?.[1] as () => void;
    requestLookup();

    expect(onLookup).toHaveBeenCalledWith('kjærlighet', expect.anything());
    expect(icon.hide).toHaveBeenCalled();
  });

  it('test_watch_selection_given_stop_expect_listeners_removed', () => {
    stop();
    selectAll(paragraph('kjærlighet'));

    expect(icon.show).not.toHaveBeenCalled();
  });
});
