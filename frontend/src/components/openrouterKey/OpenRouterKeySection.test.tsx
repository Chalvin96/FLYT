import { render as baseRender, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw/http';
import { describe, expect, it, vi } from 'vitest';
import { type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { chatbotKeys } from '@/hooks/chatbot/queries';
import { server } from '@/test/msw/server';

import { OpenRouterKeySection } from './OpenRouterKeySection';

vi.mock('@/hooks/auth/queries', () => ({
  useMe: () => ({ data: { id: 7 } }),
}));

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

describe('OpenRouterKeySection', () => {
  it('test_provider_key_section_given_refetch_failure_with_cached_surface_expect_settings_retained', async () => {
    const user = userEvent.setup();
    const { queryClient } = render(<OpenRouterKeySection />);

    const section = await screen.findByTestId('openrouter-key-section');
    expect(section).toHaveTextContent('Not connected');
    expect(
      within(section).getByRole('button', { name: 'Add key' }),
    ).toBeEnabled();

    server.use(
      http.get('*/chatbot', () =>
        HttpResponse.json(
          { detail: { message: 'temporary outage' } },
          { status: 503 },
        ),
      ),
    );

    await queryClient.refetchQueries({ queryKey: chatbotKeys.surface(7) });

    expect(
      screen.queryByText(
        'Provider key settings could not be loaded. Try again in a moment.',
      ),
    ).not.toBeInTheDocument();
    expect(section).toHaveTextContent('Not connected');
    expect(within(section).getByText('Provider key')).toBeInTheDocument();

    await user.click(within(section).getByRole('button', { name: 'Add key' }));

    expect(
      within(section).getByLabelText('Provider API key'),
    ).toBeInTheDocument();
  });
});
