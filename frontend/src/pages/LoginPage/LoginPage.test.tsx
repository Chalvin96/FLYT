import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LoginPage } from './LoginPage';

vi.mock('@/api/auth', () => ({
  googleStartUrl: () => 'http://localhost:8000/users/oauth/google/start',
  logout: vi.fn(),
  getMe: vi.fn(),
}));

describe('LoginPage', () => {
  it('renders headline, Google button, and legal copy', () => {
    render(<LoginPage />);

    expect(screen.getByText('Start learning Norwegian.')).toBeInTheDocument();
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
    expect(screen.getByText(/Privacy Policy/)).toBeInTheDocument();
  });

  it('Google button href resolves to googleStartUrl()', () => {
    render(<LoginPage />);

    const link = screen.getByRole('link', { name: 'Sign in with Google' });
    expect(link).toHaveAttribute(
      'href',
      'http://localhost:8000/users/oauth/google/start',
    );
  });

  it('error banner appears for known error codes', () => {
    render(<LoginPage error="state" />);

    expect(
      screen.getByText('Sign-in expired. Please try again.'),
    ).toBeInTheDocument();
  });

  it('no error banner for absent error param', () => {
    render(<LoginPage />);

    expect(screen.queryByText('Sign-in expired')).not.toBeInTheDocument();
  });

  it('test_login_page_given_the_deleted_flag_expect_a_confirmation_banner', () => {
    render(<LoginPage deleted />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Your account has been deleted.',
    );
  });

  it('test_login_page_given_no_deleted_flag_expect_no_confirmation_banner', () => {
    render(<LoginPage />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('denied does not render a banner', () => {
    render(<LoginPage error="denied" />);

    expect(screen.queryByText('Sign-in failed')).not.toBeInTheDocument();
  });
});
