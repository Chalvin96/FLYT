import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ErrorMessage } from './error-message';

describe('ErrorMessage', () => {
  it('test_error_message_given_string_error_expect_alert_with_title_and_message', () => {
    render(<ErrorMessage error="Network error" title="Upload failed" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Upload failed')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('test_error_message_given_error_object_expect_its_message_rendered', () => {
    render(<ErrorMessage error={new Error('Boom')} title="Upload failed" />);

    expect(screen.getByText('Boom')).toBeInTheDocument();
  });

  it('test_error_message_given_retry_and_dismiss_expect_handlers_called_once', async () => {
    const onRetry = vi.fn();
    const onDismiss = vi.fn();

    render(
      <ErrorMessage
        error={new Error('Boom')}
        onRetry={onRetry}
        retryLabel="Try again"
        onDismiss={onDismiss}
        dismissLabel="Dismiss"
        title="Upload failed"
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(onRetry).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('test_error_message_given_retry_and_dismiss_expect_matching_44px_targets', () => {
    render(
      <ErrorMessage
        error="Boom"
        onRetry={vi.fn()}
        retryLabel="Try again"
        onDismiss={vi.fn()}
        dismissLabel="Dismiss"
        title="Upload failed"
      />,
    );

    expect(screen.getByRole('button', { name: 'Try again' })).toHaveClass(
      'h-11',
    );
    expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveClass(
      'size-11',
    );
  });
});
