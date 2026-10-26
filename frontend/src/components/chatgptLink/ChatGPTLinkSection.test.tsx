import { render as baseRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw/http';
import { describe, expect, it } from 'vitest';
import { type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { ChatGPTLink } from '@/api/chatgptLink';
import { chatGPTLinkKeys } from '@/hooks/chatgptLink/queries';
import { server } from '@/test/msw/server';

import { ChatGPTLinkSection } from './ChatGPTLinkSection';

const connectedLink: ChatGPTLink = {
  state: 'working',
  broken_reason: null,
  connected_at: '2026-07-12T00:00:00Z',
  pending: null,
  model: 'gpt-5.6-luna',
  available_models: ['gpt-5.6-luna'],
};

function render(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return {
    queryClient,
    ...baseRender(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
    ),
  };
}

describe('ChatGPTLinkSection', () => {
  it('test_chatgpt_section_given_refetch_failure_with_cached_link_expect_connected_controls_retained', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('*/chatgpt/link', () => HttpResponse.json(connectedLink)),
    );

    const { queryClient } = render(<ChatGPTLinkSection />);

    expect(
      await screen.findByRole('button', { name: 'Disconnect' }),
    ).toBeEnabled();
    expect(screen.getByText(/Connected/)).toBeInTheDocument();

    server.use(
      http.get('*/chatgpt/link', () =>
        HttpResponse.json(
          { detail: { message: 'temporary outage' } },
          { status: 503 },
        ),
      ),
    );

    await queryClient.refetchQueries({ queryKey: chatGPTLinkKeys.state });

    expect(
      screen.queryByText(
        'ChatGPT connection settings could not be loaded. Try again in a moment.',
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Connected/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Disconnect' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
