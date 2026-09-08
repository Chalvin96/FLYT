import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { lazy } from 'react';

import { warmMarkdown } from '@/lib/markdown';

import { FlytChatbotPanel } from './FlytChatbotPanel';

// React's synchronous act can settle a real dynamic import inside render(),
// which leaves no reliable window to observe the genuine fallback. Replacing
// only LazyMarkdown with a never-settling lazy component holds the panel in
// its Suspense fallback; every other test file keeps the real chunk.
vi.mock('@/lib/markdown', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/markdown')>();
  return {
    ...actual,
    LazyMarkdown: lazy(() => new Promise<never>(() => undefined)),
    warmMarkdown: vi.fn(),
  };
});

const userMessage = {
  id: 'question-1',
  role: 'user' as const,
  content: 'Explain the V2 rule with a diagram.',
};

describe('FlytChatbotPanel markdown loading', () => {
  it('test_chatbot_panel_given_pending_renderer_expect_silent_skeleton_without_raw_markdown', () => {
    render(
      <FlytChatbotPanel
        messages={[
          userMessage,
          {
            id: 'answer-markdown',
            role: 'chatbot',
            content: '**V2-regelen**\n\n#### Bøying\n\n![V2 diagram](/v2.png)',
          },
        ]}
      />,
    );

    const skeleton = screen.getByTestId('chatbot-markdown-skeleton');
    expect(skeleton).toHaveAttribute('aria-hidden', 'true');
    expect(skeleton).toHaveTextContent('');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByText(/\*\*V2-regelen\*\*/)).not.toBeInTheDocument();
    expect(screen.queryByText(/v2\.png/)).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('test_chatbot_panel_given_loading_reply_expect_markdown_renderer_warmed', () => {
    const { rerender } = render(<FlytChatbotPanel messages={[userMessage]} />);

    expect(vi.mocked(warmMarkdown)).not.toHaveBeenCalled();

    rerender(<FlytChatbotPanel isLoading messages={[userMessage]} />);

    expect(vi.mocked(warmMarkdown)).toHaveBeenCalledTimes(1);
  });
});
