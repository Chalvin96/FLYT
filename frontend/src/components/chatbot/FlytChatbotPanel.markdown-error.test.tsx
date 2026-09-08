import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { lazy } from 'react';

import { FlytChatbotPanel } from './FlytChatbotPanel';

vi.mock('@/lib/markdown', () => ({
  LazyMarkdown: lazy(() => Promise.reject(new Error('chunk unavailable'))),
  warmMarkdown: vi.fn(),
}));

describe('FlytChatbotPanel Markdown error handling', () => {
  it('test_chatbot_panel_given_renderer_chunk_failure_expect_reply_remains_readable', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      render(
        <FlytChatbotPanel
          messages={[
            {
              id: 'answer-markdown-error',
              role: 'chatbot',
              content: '**V2-regelen**\n\n#### Bøying',
            },
          ]}
        />,
      );

      expect(
        await screen.findByText(/\*\*V2-regelen\*\*/, { exact: false }),
      ).toBeVisible();
      expect(
        screen.queryByRole('heading', { name: 'Bøying' }),
      ).not.toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }
  });
});
