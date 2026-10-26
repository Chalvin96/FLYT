import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ErrorMessage } from './ErrorMessage';

describe('ErrorMessage', () => {
  it('test_error_message_given_no_title_expect_flyt_default_copy', () => {
    render(<ErrorMessage error="Network error" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('test_error_message_given_retry_and_dismiss_expect_default_labels_on_both_actions', async () => {
    const onRetry = vi.fn();
    const onDismiss = vi.fn();

    render(
      <ErrorMessage
        error={new Error('Boom')}
        onRetry={onRetry}
        onDismiss={onDismiss}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(onRetry).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
