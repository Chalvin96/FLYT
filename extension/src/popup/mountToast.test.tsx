import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mountImportToast } from './mountToast';

// The real host attaches a CLOSED shadow root, which no test can read into.
// Swap in an open equivalent so assertions can see what was rendered.
vi.mock('./shadowHost', () => ({
  createShadowHost: () => {
    const container = document.createElement('div');
    const reactHost = document.createElement('div');
    container.append(reactHost);
    return { container, reactHost };
  },
}));

const IMPORTS_URL = 'http://localhost:5173/reading/imports';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('mountImportToast', () => {
  it('test_mount_toast_given_status_expect_message_rendered_in_document', () => {
    const toast = mountImportToast(IMPORTS_URL);

    act(() => toast.setStatus({ kind: 'importing' }));

    expect(document.body.textContent).toContain('Saving this page…');
  });

  it('test_mount_toast_given_success_expect_saved_copy_and_flyt_link_opens_safely', () => {
    const toast = mountImportToast(IMPORTS_URL);

    act(() => toast.setStatus({ kind: 'success' }));

    expect(document.body.textContent).toContain('Page saved');
    expect(document.body.textContent).toContain(
      'We’ll prepare it for reading. You can keep browsing.',
    );
    const link = document.querySelector('a') as HTMLAnchorElement;
    expect(link.href).toBe(IMPORTS_URL);
    expect(link.rel).toBe('noopener noreferrer');
  });

  it('test_mount_toast_given_success_expect_stays_until_explicit_dismiss', () => {
    vi.useFakeTimers();
    try {
      const toast = mountImportToast(IMPORTS_URL);

      act(() => toast.setStatus({ kind: 'success' }));
      vi.advanceTimersByTime(5000);

      expect(document.body.textContent).toContain('Page saved');
      toast.dismiss();
      expect(document.body.children).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('test_mount_toast_given_dismiss_expect_container_removed', () => {
    const toast = mountImportToast(IMPORTS_URL);
    act(() => toast.setStatus({ kind: 'importing' }));

    toast.dismiss();

    expect(document.body.children).toHaveLength(0);
  });

  it('test_mount_toast_given_close_button_click_expect_container_removed', () => {
    const toast = mountImportToast(IMPORTS_URL);
    act(() => toast.setStatus({ kind: 'error', message: 'Nope.' }));

    act(() =>
      (
        document.querySelector('[aria-label="Dismiss"]') as HTMLButtonElement
      ).click(),
    );

    expect(document.body.children).toHaveLength(0);
  });

  it('test_mount_toast_given_status_after_dismiss_expect_no_remount', () => {
    const toast = mountImportToast(IMPORTS_URL);
    toast.dismiss();

    act(() => toast.setStatus({ kind: 'success' }));
    toast.dismiss();

    expect(document.body.children).toHaveLength(0);
  });
});
