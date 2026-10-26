import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestShadowSurface } from '../test/shadowSurface';
import { resetOverlay } from './overlay';
import { mountImportToast } from './mountToast';

vi.mock('@flyt/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@flyt/ui')>()),
  createShadowSurface: () => createTestShadowSurface(),
}));

const IMPORTS_URL = 'http://localhost:5173/reading/imports';

beforeEach(() => {
  resetOverlay();
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
      act(() => toast.dismiss());
      expect(document.body.textContent).not.toContain('Page saved');
    } finally {
      vi.useRealTimers();
    }
  });

  it('test_mount_toast_given_dismiss_expect_toast_gone', () => {
    const toast = mountImportToast(IMPORTS_URL);
    act(() => toast.setStatus({ kind: 'importing' }));

    act(() => toast.dismiss());

    expect(document.body.textContent).not.toContain('Saving this page…');
  });

  it('test_mount_toast_given_close_button_click_expect_toast_gone', () => {
    const toast = mountImportToast(IMPORTS_URL);
    act(() => toast.setStatus({ kind: 'error', message: 'Nope.' }));
    expect(document.body.textContent).toContain('Nope.');

    act(() =>
      (
        document.querySelector('[aria-label="Dismiss"]') as HTMLButtonElement
      ).click(),
    );

    expect(document.body.textContent).not.toContain('Nope.');
  });

  it('test_mount_toast_given_status_after_dismiss_expect_no_remount', () => {
    const toast = mountImportToast(IMPORTS_URL);
    act(() => toast.setStatus({ kind: 'importing' }));
    act(() => toast.dismiss());

    act(() => toast.setStatus({ kind: 'success' }));

    expect(document.body.textContent).not.toContain('Page saved');
  });

  it('test_mount_toast_given_a_newer_import_expect_the_old_handle_inert', () => {
    // A late dismiss timer from an earlier import must not remove a toast the
    // newer mount owns.
    const stale = mountImportToast(IMPORTS_URL);
    act(() => stale.setStatus({ kind: 'success' }));

    const current = mountImportToast(IMPORTS_URL);
    act(() => current.setStatus({ kind: 'importing' }));

    act(() => stale.dismiss());

    expect(document.body.textContent).toContain('Saving this page…');
  });
});
