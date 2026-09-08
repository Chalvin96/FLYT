import {
  render as baseRender,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { server } from '@/test/msw/server';

import { AccountPage } from './AccountPage';

function render(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return baseRender(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

const mockNavigate = vi.fn();
const mockLogout = vi.fn();
const mockMutateAsync = vi.fn();

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router',
  );

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/hooks/auth/queries', () => ({
  useMe: vi.fn(() => ({
    data: {
      display_name: 'Ume Bocchi',
      email: 'ume@example.com',
      last_login: '2026-06-08T00:00:00Z',
      avatar_url: null,
    },
  })),
  useLogout: vi.fn(() => ({
    isPending: false,
    logout: mockLogout,
  })),
  useUpdateMe: vi.fn(() => ({
    isPending: false,
    isError: false,
    mutateAsync: mockMutateAsync,
  })),
}));

describe('AccountPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockLogout.mockReset();
    mockMutateAsync.mockReset();
    mockMutateAsync.mockResolvedValue({
      display_name: 'Updated Name',
    });
  });

  it('test_display_name_given_account_page_loads_expect_read_only_edit_action', () => {
    render(<AccountPage />);

    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^save$/i }),
    ).not.toBeInTheDocument();

    const input = screen.getByLabelText(/display name/i);
    expect(input).toHaveAttribute('readonly');
    expect(input).toHaveValue('Ume Bocchi');
  });

  it('test_chatgpt_link_given_account_page_expect_connection_controls_visible', async () => {
    render(<AccountPage />);

    expect(
      await screen.findByText('ChatGPT', { exact: true }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument();
  });

  it('test_openrouter_key_given_account_page_expect_save_replace_and_remove_controls', async () => {
    const user = userEvent.setup();
    let configured = false;
    let submittedKey: unknown;

    server.use(
      http.get('*/chatbot', () =>
        HttpResponse.json({
          models: [],
          openrouterKeyConfigured: configured,
        }),
      ),
      http.put('*/chatbot/openrouter-key', async ({ request }) => {
        submittedKey = await request.json();
        configured = true;
        return HttpResponse.json({
          openrouterKeyConfigured: true,
        });
      }),
      http.delete('*/chatbot/openrouter-key', () => {
        configured = false;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    render(<AccountPage />);

    const section = await screen.findByTestId('openrouter-key-section');
    expect(section).toHaveTextContent('Provider key');
    expect(section).toHaveTextContent('Not connected');

    await user.click(within(section).getByRole('button', { name: 'Add key' }));
    const input = within(section).getByLabelText('Provider API key');
    const key = 'sk-or-test-key-1234';
    await user.type(input, key);
    await user.click(within(section).getByRole('button', { name: 'Save key' }));

    await waitFor(() => {
      expect(submittedKey).toEqual({ apiKey: key });
      expect(section).toHaveTextContent('Connected');
    });
    expect(screen.queryByDisplayValue(key)).not.toBeInTheDocument();
    expect(section).not.toHaveTextContent('1234');
    expect(
      within(section).getByRole('button', { name: 'Update key' }),
    ).toBeInTheDocument();

    await user.click(within(section).getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(section).toHaveTextContent('Not connected');
      expect(
        within(section).getByRole('button', { name: 'Add key' }),
      ).toBeInTheDocument();
    });
  });

  it('test_display_name_given_edit_and_save_expect_updated_name', async () => {
    render(<AccountPage />);

    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }));

    const input = screen.getByLabelText(/display name/i);
    expect(input).not.toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, 'Ume B');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        display_name: 'Ume B',
      });
    });
  });

  it('test_account_page_given_a_signed_in_user_expect_sign_out_in_profile_and_delete_separate', () => {
    render(<AccountPage />);

    const profileCard = screen.getByTestId('account-profile-card');
    const signOut = screen.getByRole('button', { name: /sign out/i });
    expect(profileCard).toContainElement(signOut);
    expect(signOut).toHaveClass('h-11');

    const dangerZone = screen.getByRole('region', { name: /delete account/i });
    expect(
      within(dangerZone).getByRole('button', { name: /delete account/i }),
    ).toBeInTheDocument();
    expect(dangerZone).not.toContainElement(signOut);
  });

  it('test_account_profile_card_given_session_summary_expect_single_last_sign_in_row', () => {
    render(<AccountPage />);

    expect(screen.getAllByText('Last sign in')).toHaveLength(1);
    expect(screen.getAllByText('Email')).toHaveLength(1);
  });

  it('test_account_page_given_danger_actions_expect_touch_sized_target', () => {
    render(<AccountPage />);

    const dangerZone = screen.getByRole('region', { name: /delete account/i });
    expect(
      within(dangerZone).getByRole('button', { name: /^delete account$/i }),
    ).toHaveClass('h-11');
  });

  it('test_account_page_given_a_successful_delete_expect_redirect_to_login_with_banner', async () => {
    server.use(
      http.get('*/users/me/deletion-preview', () =>
        HttpResponse.json({
          streak: 0,
          reviews: 0,
          wordsPracticed: 0,
          importedTexts: 0,
        }),
      ),
      http.delete('*/users/me', () => new HttpResponse(null, { status: 200 })),
    );

    render(<AccountPage />);

    const dangerZone = screen.getByRole('region', { name: /delete account/i });
    await userEvent.click(
      within(dangerZone).getByRole('button', { name: /^delete account$/i }),
    );

    const dialog = await screen.findByRole('dialog');
    await userEvent.type(
      within(dialog).getByLabelText(/to confirm/i),
      'ume@example.com',
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: /^delete account$/i }),
    );

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({
        replace: true,
        search: { deleted: true },
        to: '/login',
      }),
    );
  });
});
