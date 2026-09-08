import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FlytChatbotPanel } from './FlytChatbotPanel';

const userMessage = {
  id: 'question-1',
  role: 'user' as const,
  content: 'Why does the verb come second here?',
};

const chatbotMessage = {
  id: 'answer-1',
  role: 'chatbot' as const,
  content:
    'Norwegian main clauses use the V2 rule: the finite verb stays second.',
};

describe('FlytChatbotPanel', () => {
  it('test_chatbot_panel_given_desktop_pane_expect_ask_flyt_header', () => {
    render(<FlytChatbotPanel surface="pane" />);

    expect(
      screen.getByRole('heading', { name: 'Ask Flyt' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Flyt Chatbot')).not.toBeInTheDocument();
  });

  it('test_chatbot_panel_given_conversation_expect_identity_labels_in_unboxed_flow', async () => {
    render(<FlytChatbotPanel messages={[userMessage, chatbotMessage]} />);

    const conversation = screen.getByRole('log', { name: 'Conversation' });
    expect(within(conversation).getByText('You')).toBeVisible();
    expect(within(conversation).getByText('Flyt')).toBeVisible();
    expect(
      screen.getByText('Why does the verb come second here?'),
    ).toBeVisible();
    expect(
      await screen.findByText(
        'Norwegian main clauses use the V2 rule: the finite verb stays second.',
      ),
    ).toBeVisible();
  });

  it('test_chatbot_panel_given_chatbot_markdown_expect_structured_answer_rendered', async () => {
    render(
      <FlytChatbotPanel
        messages={[
          userMessage,
          {
            id: 'answer-markdown',
            role: 'chatbot',
            content:
              '**V2-regelen** betyr at verbet kommer på plass nummer to.\n\n#### Bøying\n\n> Husk verbet.\n\n---\n\nEksempler:\n\n- I dag **leser** jeg hjemme.\n- Nå **forstår** du regelen.\n\n| Regel | Eksempel |\n| --- | --- |\n| V2 | Verbet står på plass to. |\n\n~~gammel forklaring~~\n\n![V2 diagram](/v2.png)',
          },
        ]}
      />,
    );

    expect(
      await screen.findByText('V2-regelen', { selector: 'strong' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Bøying' }),
    ).toBeVisible();
    expect(screen.getByText('Husk verbet.')).toBeVisible();
    expect(screen.getByRole('separator')).toBeVisible();
    expect(screen.getByRole('list')).toBeVisible();
    expect(screen.getByRole('table')).toBeVisible();
    expect(
      screen.getByRole('cell', { name: 'Verbet står på plass to.' }),
    ).toBeVisible();
    expect(
      screen.getByText('gammel forklaring', { selector: 'del' }),
    ).toBeVisible();
    expect(screen.getByText(/I dag/)).toBeVisible();
    expect(screen.getByText(/Nå/)).toBeVisible();
    expect(screen.queryByText(/\*\*V2-regelen\*\*/)).not.toBeInTheDocument();

    const image = await screen.findByRole('img', { name: 'V2 diagram' });
    const loadingSkeleton = screen.getByTestId(
      'chatbot-markdown-image-loading',
    );
    expect(loadingSkeleton).toBeVisible();
    expect(loadingSkeleton).toHaveAttribute('aria-hidden', 'true');
    expect(loadingSkeleton).toHaveClass('import-cover-shimmer');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(image).toHaveClass('opacity-0');
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');

    fireEvent.load(image);

    expect(
      screen.queryByTestId('chatbot-markdown-image-loading'),
    ).not.toBeInTheDocument();
    expect(image).toHaveClass('opacity-100', 'transition-opacity');
  });

  it('test_chatbot_panel_given_cached_image_expect_image_revealed_without_load_event', async () => {
    const complete = vi
      .spyOn(HTMLImageElement.prototype, 'complete', 'get')
      .mockReturnValue(true);
    const naturalWidth = vi
      .spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get')
      .mockReturnValue(640);

    try {
      render(
        <FlytChatbotPanel
          messages={[
            userMessage,
            {
              id: 'answer-cached-image',
              role: 'chatbot',
              content: '![Cached V2 diagram](/v2.png)',
            },
          ]}
        />,
      );

      const image = await screen.findByRole('img', {
        name: 'Cached V2 diagram',
      });
      expect(image).toHaveClass('opacity-100');
      expect(
        screen.queryByTestId('chatbot-markdown-image-loading'),
      ).not.toBeInTheDocument();
    } finally {
      complete.mockRestore();
      naturalWidth.mockRestore();
    }
  });

  it('test_chatbot_panel_given_safe_and_unsafe_links_expect_only_safe_targets', async () => {
    render(
      <FlytChatbotPanel
        messages={[
          userMessage,
          {
            id: 'answer-links',
            role: 'chatbot',
            content:
              '[Lesson](/lessons/12) [Source](https://example.com) [Unsafe](javascript:alert(1))',
          },
        ]}
      />,
    );

    const lessonLink = await screen.findByRole('link', { name: 'Lesson' });
    expect(lessonLink).toHaveAttribute(
      'href',
      'http://localhost:3000/lessons/12',
    );
    expect(lessonLink).not.toHaveAttribute('target');

    const sourceLink = screen.getByRole('link', { name: /Source/ });
    expect(sourceLink).toHaveAttribute('href', 'https://example.com/');
    expect(sourceLink).toHaveAttribute('target', '_blank');
    expect(
      screen.queryByRole('link', { name: 'Unsafe' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Unsafe')).toBeVisible();
  });

  it('test_chatbot_panel_given_image_load_failure_expect_compact_alt_fallback', async () => {
    render(
      <FlytChatbotPanel
        messages={[
          userMessage,
          {
            id: 'answer-broken-image',
            role: 'chatbot',
            content: 'Se skissen:\n\n![V2 diagram](/v2.png)',
          },
        ]}
      />,
    );

    const image = await screen.findByRole('img', { name: 'V2 diagram' });
    fireEvent.error(image);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('chatbot-markdown-image-loading'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Image unavailable — V2 diagram')).toBeVisible();
  });

  it('test_chatbot_panel_given_unsafe_image_sources_expect_images_not_rendered', async () => {
    render(
      <FlytChatbotPanel
        messages={[
          userMessage,
          {
            id: 'answer-unsafe-image',
            role: 'chatbot',
            content: `Unsafe images:\n\n![HTTPS image](https://example.com/v2.png)\n\n![HTTP image](http://example.com/v2.png)\n\n![Data image](data:image/svg+xml,<svg />)\n\n![Blob image](blob:${window.location.origin}/v2.png)`,
          },
        ]}
      />,
    );

    await screen.findByText('Unsafe images:');

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText(/example\.com/)).not.toBeInTheDocument();
  });

  it('test_chatbot_panel_given_raw_html_in_chatbot_reply_expect_html_not_mounted', async () => {
    render(
      <FlytChatbotPanel
        messages={[
          userMessage,
          {
            id: 'answer-raw-html',
            role: 'chatbot',
            content: 'Safe text\n\n<script>window.alert(1)</script>',
          },
        ]}
      />,
    );

    expect(await screen.findByText('Safe text')).toBeVisible();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByText('window.alert(1)')).not.toBeInTheDocument();
  });

  it('test_chatbot_panel_given_user_markdown_like_text_expect_literal_text_preserved', () => {
    render(
      <FlytChatbotPanel
        messages={[
          {
            id: 'literal-user',
            role: 'user',
            content: '**Do not format this**\n- keep the dash',
          },
        ]}
      />,
    );

    const userText = screen.getByText('**Do not format this**', {
      exact: false,
    });
    expect(userText).toHaveClass('whitespace-pre-wrap');
    expect(userText).toHaveTextContent('- keep the dash');
  });

  it('test_chatbot_panel_given_lesson_context_expect_context_details_render', () => {
    render(
      <FlytChatbotPanel
        context={{
          kind: 'lesson',
          label: 'Word order in main clauses',
          detail: 'Practice 2 of 5',
        }}
      />,
    );

    expect(screen.getByTestId('chatbot-context')).toHaveTextContent(
      'Word order in main clauses',
    );
    expect(screen.getByTestId('chatbot-context')).toHaveTextContent(
      'Practice 2 of 5',
    );
    expect(
      screen.getByPlaceholderText('Ask about this context…'),
    ).toBeInTheDocument();
  });

  it('test_chatbot_panel_given_prompt_selected_expect_draft_filled', async () => {
    const user = userEvent.setup();
    render(<FlytChatbotPanel starterPrompts={['Explain this phrase']} />);

    await user.click(
      screen.getByRole('button', { name: 'Explain this phrase' }),
    );

    expect(screen.getByRole('textbox', { name: 'Ask a question' })).toHaveValue(
      'Explain this phrase',
    );
  });

  it('test_chatbot_panel_given_message_and_model_expect_send_callback', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<FlytChatbotPanel onSend={onSend} />);

    await user.type(
      screen.getByRole('textbox', { name: 'Ask a question' }),
      'Explain V2',
    );
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(onSend).toHaveBeenCalledWith('Explain V2', 'flyt');
    expect(screen.getByRole('textbox', { name: 'Ask a question' })).toHaveValue(
      '',
    );
  });

  it('test_chatbot_panel_given_submitted_message_expect_scroller_follow_latest', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<FlytChatbotPanel messages={[chatbotMessage]} onSend={onSend} />);

    const viewport = screen.getByTestId('chatbot-messages');
    const scrollTo = vi.fn();
    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 500 },
      scrollTop: { configurable: true, value: 0, writable: true },
      scrollTo: { configurable: true, value: scrollTo },
    });

    await user.type(
      screen.getByRole('textbox', { name: 'Ask a question' }),
      'Explain V2',
    );
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(scrollTo).toHaveBeenCalledWith({ behavior: 'auto', top: 400 });
  });

  it('test_chatbot_panel_given_submitted_message_and_scroll_gesture_expect_follow_cancelled', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const { rerender } = render(
      <FlytChatbotPanel messages={[chatbotMessage]} onSend={onSend} />,
    );

    const viewport = screen.getByTestId('chatbot-messages');
    const scrollTo = vi.fn();
    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 500 },
      scrollTop: { configurable: true, value: 0, writable: true },
      scrollTo: { configurable: true, value: scrollTo },
    });

    await user.type(
      screen.getByRole('textbox', { name: 'Ask a question' }),
      'Explain V2',
    );
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    scrollTo.mockClear();

    fireEvent.wheel(viewport);
    rerender(
      <FlytChatbotPanel
        isLoading
        messages={[chatbotMessage, userMessage]}
        onSend={onSend}
      />,
    );

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('test_chatbot_panel_given_context_remove_expect_context_callback_and_touch_target', async () => {
    const user = userEvent.setup();
    const onContextRemove = vi.fn();
    const context = {
      kind: 'selection' as const,
      label: 'fordi jeg ikke kan komme',
    };
    render(
      <FlytChatbotPanel context={context} onContextRemove={onContextRemove} />,
    );

    const removeButton = screen.getByRole('button', {
      name: 'Remove context',
    });
    expect(removeButton).toHaveClass('size-7');
    expect(removeButton).toHaveClass('after:-inset-2');
    await user.click(removeButton);

    expect(onContextRemove).toHaveBeenCalledWith(context);
  });

  it('test_chatbot_panel_given_unavailable_flyt_expect_chatgpt_selected_and_sendable', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<FlytChatbotPanel onSend={onSend} unavailableModels={['flyt']} />);

    expect(
      screen.getByRole('radio', {
        name: 'Flyt, not available right now',
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole('radio', { name: 'ChatGPT, powered by Luna' }),
    ).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('chatbot-availability-notice')).toHaveTextContent(
      'Flyt is unavailable — switched to ChatGPT',
    );

    await user.type(
      screen.getByRole('textbox', { name: 'Ask a question' }),
      'Hei',
    );
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(onSend).toHaveBeenCalledWith('Hei', 'chatgpt');
  });

  it('test_chatbot_panel_given_flyt_availability_expect_no_usage_details', () => {
    render(<FlytChatbotPanel />);

    expect(screen.getByRole('radio', { name: 'Flyt' })).toBeInTheDocument();
    expect(
      screen.queryByText(/messages|free|month|left/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('chatbot-availability-notice'),
    ).not.toBeInTheDocument();
  });

  it('test_chatbot_panel_given_model_pills_expect_all_providers_with_luna_detail', () => {
    render(<FlytChatbotPanel />);

    expect(screen.getAllByRole('radio')).toHaveLength(4);
    const chatgpt = screen.getByRole('radio', {
      name: 'ChatGPT, powered by Luna',
    });
    expect(chatgpt).toHaveAttribute('title', 'ChatGPT · powered by Luna');
    expect(chatgpt).toHaveTextContent('ChatGPT');
    expect(screen.getByRole('radio', { name: 'DeepSeek' })).toBeEnabled();
    const zAi = screen.getByRole('radio', { name: 'z.ai' });
    expect(zAi).toBeEnabled();
    expect(zAi).toHaveTextContent('z.ai');
    expect(
      screen.getByRole('radiogroup', { name: 'Choose model' }),
    ).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('test_chatbot_panel_given_model_copy_expect_no_provider_plumbing_or_internal_labels', () => {
    render(<FlytChatbotPanel />);

    expect(screen.queryByText(/openrouter/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/glm/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/key suffix|api key/i)).not.toBeInTheDocument();
  });

  it('test_chatbot_panel_given_unconfigured_direct_provider_expect_account_guidance', () => {
    render(
      <FlytChatbotPanel
        modelReasons={{ deepseek: 'openrouter_key_required' }}
        unavailableModels={['deepseek']}
      />,
    );

    const deepseek = screen.getByRole('radio', {
      name: 'DeepSeek, set up a provider key in Account settings',
    });
    expect(deepseek).toBeDisabled();
    expect(deepseek).toHaveAttribute(
      'title',
      'DeepSeek · set up a provider key in Account settings',
    );
    expect(screen.getByRole('radio', { name: 'Flyt' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('test_chatbot_panel_given_no_usable_model_expect_send_blocked_with_notice', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(
      <FlytChatbotPanel
        onSend={onSend}
        unavailableModels={['flyt', 'chatgpt', 'deepseek', 'glm']}
      />,
    );

    expect(screen.getByTestId('chatbot-availability-notice')).toHaveTextContent(
      'No available model is connected. Connect a model to keep going.',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Ask a question' }),
      'Hei',
    );
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('test_chatbot_panel_given_no_connected_model_expect_send_blocked_with_notice', () => {
    render(
      <FlytChatbotPanel
        unavailableModels={['flyt', 'chatgpt', 'deepseek', 'glm']}
      />,
    );

    expect(screen.getByTestId('chatbot-availability-notice')).toHaveTextContent(
      'No available model is connected. Connect a model to keep going.',
    );
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });

  it('test_chatbot_panel_given_unavailable_selected_model_expect_fallback_notice', () => {
    render(
      <FlytChatbotPanel
        defaultModel="chatgpt"
        unavailableModels={['chatgpt']}
      />,
    );

    expect(screen.getByRole('radio', { name: /^Flyt/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByTestId('chatbot-availability-notice')).toHaveTextContent(
      'ChatGPT is unavailable — switched to Flyt',
    );
  });

  it('test_chatbot_panel_given_chatgpt_selected_expect_send_uses_chatgpt', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<FlytChatbotPanel onSend={onSend} />);

    await user.click(screen.getByRole('radio', { name: /^ChatGPT/ }));
    expect(screen.getByRole('radio', { name: /^ChatGPT/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await user.type(
      screen.getByRole('textbox', { name: 'Ask a question' }),
      'Hei',
    );
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(onSend).toHaveBeenCalledWith('Hei', 'chatgpt');
  });

  it('test_chatbot_panel_given_model_pills_expect_arrow_key_moves_selection', async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    render(<FlytChatbotPanel onModelChange={onModelChange} />);

    const flyt = screen.getByRole('radio', { name: /^Flyt/ });
    flyt.focus();
    await user.keyboard('{ArrowRight}');

    const chatgpt = screen.getByRole('radio', { name: /^ChatGPT/ });
    expect(chatgpt).toHaveFocus();
    expect(chatgpt).toHaveAttribute('aria-checked', 'true');
    expect(flyt).toHaveAttribute('aria-checked', 'false');
    expect(onModelChange).toHaveBeenCalledWith('chatgpt');
  });

  it('test_chatbot_panel_given_disabled_model_expect_arrow_key_skips_it', async () => {
    const user = userEvent.setup();
    render(<FlytChatbotPanel unavailableModels={['chatgpt']} />);

    const flyt = screen.getByRole('radio', { name: /^Flyt/ });
    flyt.focus();
    await user.keyboard('{ArrowRight}');

    const deepseek = screen.getByRole('radio', { name: /^DeepSeek/ });
    expect(deepseek).toHaveFocus();
    expect(deepseek).toHaveAttribute('aria-checked', 'true');
    expect(flyt).toHaveAttribute('aria-checked', 'false');
  });

  it('test_chatbot_panel_given_completed_answer_expect_follow_up_actions', async () => {
    const user = userEvent.setup();
    const onFollowUpSelect = vi.fn();
    render(
      <FlytChatbotPanel
        messages={[userMessage, chatbotMessage]}
        followUpPrompts={[
          'Explain the V2 rule',
          'Show me another example',
          'Give me a practice question',
          'Quiz me on word order',
        ]}
        onFollowUpSelect={onFollowUpSelect}
      />,
    );

    expect(screen.getByRole('region', { name: 'Keep going' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Explain the V2 rule' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Give me a practice question' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Quiz me on word order' }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Explain the V2 rule' }),
    );

    expect(onFollowUpSelect).toHaveBeenCalledWith('Explain the V2 rule');
    expect(screen.getByRole('textbox', { name: 'Ask a question' })).toHaveValue(
      'Explain the V2 rule',
    );
  });

  it('test_chatbot_panel_given_completed_answer_while_loading_expect_follow_up_actions_hidden', () => {
    render(
      <FlytChatbotPanel
        isLoading
        messages={[userMessage, chatbotMessage]}
        followUpPrompts={['Explain the V2 rule']}
      />,
    );

    expect(
      screen.queryByRole('region', { name: 'Keep going' }),
    ).not.toBeInTheDocument();
  });

  it('test_chatbot_panel_given_empty_loading_state_expect_one_status', () => {
    render(<FlytChatbotPanel isLoading />);

    const liveStatus = screen.getByTestId('chatbot-live-status');
    expect(liveStatus).toHaveAttribute('aria-live', 'polite');
    expect(liveStatus).toHaveClass('sr-only');
    expect(liveStatus).toHaveTextContent('Thinking…');
    expect(
      within(screen.getByRole('log', { name: 'Conversation' })).getByText(
        'Thinking…',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('log', { name: 'Conversation' })).toHaveAttribute(
      'aria-live',
      'off',
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('test_chatbot_panel_given_completed_reply_expect_polite_announcement', () => {
    const { rerender } = render(<FlytChatbotPanel messages={[userMessage]} />);

    const liveStatus = screen.getByTestId('chatbot-live-status');
    expect(liveStatus).toHaveTextContent('');

    rerender(
      <FlytChatbotPanel isLoading messages={[userMessage, chatbotMessage]} />,
    );
    expect(liveStatus).toHaveTextContent('Thinking…');

    rerender(<FlytChatbotPanel messages={[userMessage, chatbotMessage]} />);
    expect(liveStatus).toHaveTextContent('Flyt replied');
  });

  it('test_chatbot_panel_given_chatgpt_reply_expect_model_name_announced', () => {
    const chatgptMessage = {
      ...chatbotMessage,
      model: 'chatgpt' as const,
    };
    render(<FlytChatbotPanel messages={[userMessage, chatgptMessage]} />);

    expect(screen.getByTestId('chatbot-live-status')).toHaveTextContent(
      'ChatGPT replied',
    );
    expect(
      within(screen.getByRole('log', { name: 'Conversation' })).getByText(
        'ChatGPT',
      ),
    ).toBeVisible();
  });

  it('test_chatbot_panel_given_error_expect_log_without_nested_alert', () => {
    render(<FlytChatbotPanel error="The chatbot is unavailable" />);

    const log = screen.getByRole('log', { name: 'Conversation' });
    expect(log).toHaveAttribute('aria-live', 'off');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(within(log).getByText('The chatbot is unavailable')).toBeVisible();
    expect(screen.getByTestId('chatbot-live-status')).toHaveTextContent(
      'The chatbot is unavailable',
    );
  });

  it('test_chatbot_panel_given_fallback_expect_announced_notice', () => {
    render(
      <FlytChatbotPanel
        defaultModel="chatgpt"
        unavailableModels={['chatgpt']}
      />,
    );

    expect(screen.getByTestId('chatbot-live-status')).toHaveTextContent(
      'ChatGPT is unavailable — switched to Flyt',
    );
  });

  it('test_chatbot_panel_given_flyt_percentage_expect_only_while_flyt_selected', async () => {
    const user = userEvent.setup();
    render(
      <FlytChatbotPanel flytRemainingPercent={42} defaultModel="chatgpt" />,
    );

    expect(screen.queryByTestId('chatbot-flyt-usage')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /^Flyt/ }));

    expect(screen.getByTestId('chatbot-flyt-usage')).toHaveTextContent(
      '42% left',
    );
    expect(
      screen.queryByText(/message|allowance|quota/i),
    ).not.toBeInTheDocument();
  });

  it('test_chatbot_panel_given_context_note_expect_separator_marker', () => {
    render(
      <FlytChatbotPanel
        messages={[
          { id: 'context-1', role: 'note', content: 'Current lesson' },
        ]}
      />,
    );

    const marker = screen.getByTestId('chatbot-context-note');
    expect(marker).toHaveClass('before:bg-border');
    expect(marker).toHaveClass('after:bg-border');
  });

  it('test_chatbot_panel_given_starter_prompts_expect_capped_at_three', () => {
    render(
      <FlytChatbotPanel
        starterPrompts={[
          'Explain the V2 rule',
          'Show me another example',
          'Give me a practice question',
          'Quiz me on word order',
        ]}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Explain the V2 rule' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Give me a practice question' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Quiz me on word order' }),
    ).not.toBeInTheDocument();
  });

  it('test_chatbot_panel_given_general_context_expect_no_attached_source_copy', () => {
    render(
      <FlytChatbotPanel
        context={{ kind: 'general', label: 'Home dashboard' }}
      />,
    );

    expect(screen.getByText('What do you want to ask?')).toBeVisible();
    expect(
      screen.queryByText('Ask about this context'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Ask a question' }),
    ).toHaveAttribute('placeholder', 'Ask anything about Norwegian…');
  });

  it('test_chatbot_panel_given_lesson_context_expect_attached_source_copy', () => {
    render(
      <FlytChatbotPanel
        context={{ kind: 'lesson', label: 'Word order in main clauses' }}
      />,
    );

    expect(screen.getByText('Ask about this context')).toBeVisible();
    expect(
      screen.getByRole('textbox', { name: 'Ask a question' }),
    ).toHaveAttribute('placeholder', 'Ask about this context…');
  });

  it('test_chatbot_panel_given_locked_model_expect_readable_state_without_opacity', () => {
    render(<FlytChatbotPanel unavailableModels={['deepseek']} />);

    const deepseek = screen.getByRole('radio', {
      name: 'DeepSeek, not connected',
    });
    expect(deepseek).toHaveClass('text-muted-foreground');
    expect(deepseek).toHaveClass('bg-muted');
    expect(deepseek).not.toHaveClass('opacity-45');
  });

  it('test_chatbot_panel_given_composer_hint_expect_hidden_below_desktop_viewport', () => {
    render(<FlytChatbotPanel />);

    const hint = screen.getByText('Shift + Enter for a new line');
    expect(hint).toHaveClass('hidden');
    expect(hint).toHaveClass('md:group-has-[textarea:focus]/composer:block');
  });

  it('test_chatbot_panel_given_header_actions_expect_labelled_icon_button_targets', () => {
    render(<FlytChatbotPanel onClose={() => undefined} />);

    for (const label of ['New conversation', 'Close chatbot']) {
      expect(screen.getByRole('button', { name: label })).toHaveClass(
        'size-11',
      );
    }
    expect(
      screen.queryByRole('button', { name: 'Conversation history' }),
    ).not.toBeInTheDocument();
  });

  it('test_chatbot_panel_given_message_viewport_expect_contained_scrolling', () => {
    render(<FlytChatbotPanel messages={[userMessage]} />);

    const viewport = screen.getByTestId('chatbot-messages');
    expect(viewport).toHaveClass('overscroll-contain');
    expect(viewport).toHaveClass('overflow-y-auto');
    expect(viewport).toHaveStyle({ overflowAnchor: 'none' });
    expect(viewport).toHaveAttribute('data-slot', 'message-scroller-viewport');
    expect(viewport).toHaveClass('focus-visible:ring-2');

    const scrollButton = screen.getByRole('button', {
      name: 'Scroll to latest',
    });
    expect(scrollButton).toHaveClass('size-11');
    expect(scrollButton).toHaveClass('focus-visible:ring-2');
  });

  it('test_chatbot_panel_given_send_control_expect_minimum_touch_target', () => {
    render(<FlytChatbotPanel />);

    expect(screen.getByRole('button', { name: 'Send message' })).toHaveClass(
      'size-11',
    );
  });
});
