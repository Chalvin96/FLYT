import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type UserRead } from '@/types/api';

import { HomePage } from './HomePage';

const useMeMock = vi.fn();

vi.mock('@tanstack/react-router', async () => {
  const { MockLink } = await import('@/test/mockLink');

  return {
    Link: MockLink,
  };
});

vi.mock('@/hooks/auth/queries', () => ({
  useMe: () => useMeMock(),
}));

describe('HomePage', () => {
  beforeEach(() => {
    useMeMock.mockReturnValue({ data: undefined });
  });

  it('test_landing_hero_given_any_visitor_expect_headline_and_promise', () => {
    render(<HomePage />);

    expect(
      screen.getByRole('heading', { level: 1, name: /know it on sight/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/becomes a review card/i)).toBeInTheDocument();
  });

  it('test_landing_sections_given_any_visitor_expect_loop_review_and_faq', () => {
    render(<HomePage />);

    expect(
      screen.getByRole('heading', { name: /ours do/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /one review queue/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /what it replaces/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /questions/i }),
    ).toBeInTheDocument();
  });

  it('test_landing_header_given_logged_out_visitor_expect_sign_in_calls_to_action', () => {
    render(<HomePage />);

    expect(
      screen.getAllByRole('link', { name: /Start free/ }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Log in/ })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Go to app/ }),
    ).not.toBeInTheDocument();
  });

  it('test_landing_header_given_authenticated_visitor_expect_app_link', () => {
    const user: UserRead = {
      id: 1,
      uuid: 'u-1',
      email: 'a@b.no',
      display_name: 'Ada',
      avatar_url: null,
      last_login: null,
    };
    useMeMock.mockReturnValue({ data: user });

    render(<HomePage />);

    const appLink = screen.getByRole('link', { name: /Go to app/ });

    expect(appLink).toBeInTheDocument();
    expect(appLink).toHaveAttribute('href', '/home');
    expect(
      screen.queryByRole('link', { name: /Log in/ }),
    ).not.toBeInTheDocument();
  });
});
