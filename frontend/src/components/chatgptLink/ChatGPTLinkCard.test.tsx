import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ChatGPTLink } from '@/api/chatgptLink';

import { ChatGPTLinkCard } from './ChatGPTLinkCard';

const absentLink: ChatGPTLink = {
  state: 'absent',
  broken_reason: null,
  connected_at: null,
  pending: null,
  model: 'gpt-5.6-luna',
  available_models: ['gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6-sol'],
};

function renderCard(link: ChatGPTLink = absentLink, options = {}) {
  return render(
    <ChatGPTLinkCard
      link={link}
      onConnect={vi.fn()}
      onDisconnect={vi.fn()}
      {...options}
    />,
  );
}

describe('ChatGPTLinkCard', () => {
  it('test_not_connected_given_absent_link_expect_connect_action', () => {
    renderCard();

    expect(screen.getByText('Not connected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument();
  });

  it('test_connected_given_a_stale_authorization_expect_no_code_dialog', () => {
    renderCard(
      {
        ...absentLink,
        state: 'working',
        connected_at: '2026-07-12T10:00:00',
        pending: null,
      },
      {
        authorization: {
          user_code: 'QYTZ-WD1Q4',
          verification_url: 'https://auth.openai.com/codex/device',
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        },
      },
    );

    expect(screen.queryByText(/QYTZ-WD1Q4/)).not.toBeInTheDocument();
    expect(screen.queryByText(/expires in/)).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Disconnect' }),
    ).toBeInTheDocument();
  });

  it('test_waiting_given_pending_link_expect_code_and_show_code_action', () => {
    renderCard({
      ...absentLink,
      pending: {
        user_code: 'QYTZ-WD1Q4',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    expect(screen.getByText(/QYTZ-WD1Q4 · expires in/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Show code' }),
    ).toBeInTheDocument();
  });

  it('test_working_given_working_link_expect_connected_date_and_disconnect_action', () => {
    renderCard({
      ...absentLink,
      state: 'working',
      connected_at: '2026-07-12T00:00:00Z',
    });

    expect(screen.getByText(/Connected/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Disconnect' }),
    ).toBeInTheDocument();
  });

  it('test_broken_given_broken_link_expect_cause_banner_and_reconnect_action', () => {
    renderCard({
      ...absentLink,
      state: 'broken',
      broken_reason: 'refresh_token_reused',
    });

    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    expect(
      screen.getByText(/another application signed in/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reconnect' }),
    ).toBeInTheDocument();
  });

  it('test_code_modal_given_waiting_link_expect_dismissal_keeps_code_recoverable', async () => {
    const user = userEvent.setup();
    renderCard({
      ...absentLink,
      pending: {
        user_code: 'QYTZ-WD1Q4',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    await user.click(screen.getByRole('button', { name: 'Show code' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Show code' }),
    ).toBeInTheDocument();
  });

  it('test_lapsed_code_given_expired_pending_link_expect_new_code_action', () => {
    renderCard({
      ...absentLink,
      pending: {
        user_code: 'QYTZ-WD1Q4',
        expires_at: new Date(Date.now() - 1_000).toISOString(),
      },
    });

    expect(
      screen.getByText('This code has expired. Get a new code to continue.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Get a new code' }),
    ).toBeInTheDocument();
  });

  it('test_terminal_ineligibility_given_flag_expect_no_retry_action', () => {
    renderCard(absentLink, { terminalIneligible: true });

    expect(screen.getByText(/plan does not include/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /connect|reconnect|retry/i }),
    ).not.toBeInTheDocument();
  });

  it('test_disconnect_confirmation_given_working_link_expect_revocation_copy_and_account_disclosure', async () => {
    const user = userEvent.setup();
    renderCard({ ...absentLink, state: 'working' });

    await user.click(screen.getByRole('button', { name: 'Disconnect' }));

    expect(
      screen.getByText(
        'Flyt will delete its copy of the connection and ask OpenAI to revoke it.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Deleting your Flyt account also asks OpenAI to revoke/),
    ).toBeInTheDocument();
  });

  it('test_connected_given_multiple_available_models_expect_no_model_picker', () => {
    renderCard({
      ...absentLink,
      state: 'working',
      available_models: ['gpt-5.6-luna', 'gpt-5.6-terra'],
    });

    expect(screen.queryByLabelText('Model')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('test_failure_banner_given_retryable_failure_expect_cta', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderCard(absentLink, {
      failure: {
        cta: { label: 'Try again', onClick },
        message: 'ChatGPT could not be reached.',
      },
    });

    expect(
      screen.getByText('ChatGPT could not be reached.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onClick).toHaveBeenCalled();
  });

  it('test_failure_banner_given_failure_expect_announced_to_assistive_tech', () => {
    renderCard(absentLink, {
      failure: { message: 'ChatGPT could not be reached.' },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'ChatGPT could not be reached.',
    );
  });
});
