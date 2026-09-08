import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ImportToast } from './ImportToast';

const IMPORTS_URL = 'http://localhost:5173/reading/imports';
const noop = () => {};

describe('ImportToast', () => {
  it('test_toast_given_importing_expect_status_live_region', () => {
    render(
      <ImportToast
        status={{ kind: 'importing' }}
        importsUrl={IMPORTS_URL}
        onClose={noop}
      />,
    );
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Saving this page…')).toBeInTheDocument();
  });

  it('test_toast_given_success_expect_saved_copy_and_flyt_link', () => {
    render(
      <ImportToast
        status={{ kind: 'success' }}
        importsUrl={IMPORTS_URL}
        onClose={noop}
      />,
    );
    expect(screen.getByText('Page saved')).toBeInTheDocument();
    expect(
      screen.getByText(
        'We’ll prepare it for reading. You can keep browsing.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'View in Flyt' }),
    ).toHaveAttribute('href', IMPORTS_URL);
  });

  it('test_toast_given_error_expect_message', () => {
    render(
      <ImportToast
        status={{ kind: 'error', message: 'This page is too large to import.' }}
        importsUrl={IMPORTS_URL}
        onClose={noop}
      />,
    );
    expect(
      screen.getByText('This page is too large to import.'),
    ).toBeInTheDocument();
  });

  it('test_toast_given_dismiss_click_expect_on_close_called', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ImportToast
        status={{ kind: 'success' }}
        importsUrl={IMPORTS_URL}
        onClose={onClose}
      />,
    );
    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
