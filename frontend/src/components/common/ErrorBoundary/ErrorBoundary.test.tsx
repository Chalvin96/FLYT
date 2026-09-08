import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { AxiosError } from 'axios';

import { ErrorBoundary } from './ErrorBoundary';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

describe('ErrorBoundary', () => {
  it('renders fallback content for unknown errors', () => {
    const onLogError = vi.fn();

    render(
      <ErrorBoundary
        error={{ code: 42 }}
        showHomeLink={false}
        onLogError={onLogError}
      />,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Something went wrong',
    );
    expect(screen.getByText('Please try again.')).toBeInTheDocument();
    expect(onLogError).toHaveBeenCalledWith({ code: 42 });
  });

  it('uses reset callback when retry is clicked', async () => {
    const onLogError = vi.fn();
    const reset = vi.fn();

    render(
      <ErrorBoundary
        error="Request failed"
        reset={reset}
        showHomeLink={false}
        onLogError={onLogError}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(reset).toHaveBeenCalledOnce();
  });

  it('reloads the page when reset is not provided', async () => {
    const onLogError = vi.fn();
    const onHardReset = vi.fn();

    render(
      <ErrorBoundary
        error="Request failed"
        showHomeLink={false}
        onLogError={onLogError}
        onHardReset={onHardReset}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onHardReset).toHaveBeenCalledOnce();
  });

  it('renders a home link by default', () => {
    const onLogError = vi.fn();

    render(<ErrorBoundary error="Request failed" onLogError={onLogError} />);

    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute(
      'href',
      '/home',
    );
  });

  it('renders Axios error messages', () => {
    const onLogError = vi.fn();

    render(
      <ErrorBoundary
        error={new AxiosError('Backend request timed out')}
        showHomeLink={false}
        onLogError={onLogError}
      />,
    );

    expect(screen.getByText('Backend request timed out')).toBeInTheDocument();
  });

  it('hides error detail when showError is false', () => {
    const onLogError = vi.fn();

    render(
      <ErrorBoundary
        error={null}
        title="Page not found"
        showError={false}
        onLogError={onLogError}
      />,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Page not found',
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Try again' }),
    ).not.toBeInTheDocument();
    expect(onLogError).not.toHaveBeenCalled();
  });
});
