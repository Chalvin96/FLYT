import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { ChatbotMessageRequest } from '@/api/chatbot';
import { server } from '@/test/msw/server';

import {
  ChatbotProvider,
  useChatbot,
  useChatbotPageContext,
} from './ChatbotProvider';
import type {
  FlytChatbotContext,
  FlytChatbotMessage,
} from './FlytChatbotPanel';

const lesson: FlytChatbotContext = {
  kind: 'lesson',
  label: 'Word order in main clauses',
  detail: 'Practice 2 of 5',
};

const reading: FlytChatbotContext = {
  kind: 'reading',
  label: 'A morning in Bergen',
};

const selection: FlytChatbotContext = {
  kind: 'selection',
  label: 'før kaféene åpner',
};

const conversation: readonly FlytChatbotMessage[] = [
  { id: 'q', role: 'user', content: 'Why does the verb come second?' },
  { id: 'a', role: 'chatbot', content: 'Norwegian main clauses use V2.' },
];

const wrapperWith = (initialMessages: readonly FlytChatbotMessage[] = []) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ChatbotProvider initialMessages={initialMessages}>
        {children}
      </ChatbotProvider>
    );
  };

const renderChatbot = (initialMessages: readonly FlytChatbotMessage[] = []) =>
  renderHook(() => useChatbot(), { wrapper: wrapperWith(initialMessages) });

const remoteWrapper = (initialMessages: readonly FlytChatbotMessage[] = []) =>
  function RemoteWrapper({ children }: { children: ReactNode }) {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    return (
      <QueryClientProvider client={queryClient}>
        <ChatbotProvider remote initialMessages={initialMessages}>
          {children}
        </ChatbotProvider>
      </QueryClientProvider>
    );
  };

describe('ChatbotProvider', () => {
  it('test_chatbot_open_state_given_no_action_expect_auto', () => {
    const { result } = renderChatbot();

    expect(result.current.openState).toBe('auto');
    expect(result.current.context).toBeNull();
  });

  it('test_chatbot_open_given_context_expect_open_and_pinned', () => {
    const { result } = renderChatbot();

    act(() => result.current.open(selection));

    expect(result.current.openState).toBe('open');
    expect(result.current.context).toEqual(selection);
  });

  it('test_chatbot_close_given_open_expect_closed_state', () => {
    const { result } = renderChatbot();

    act(() => result.current.open());
    act(() => result.current.close());

    expect(result.current.openState).toBe('closed');
  });

  it('test_chatbot_context_given_page_context_expect_ambient_used', () => {
    const { result } = renderHook(
      () => {
        useChatbotPageContext(lesson);
        return useChatbot();
      },
      { wrapper: wrapperWith() },
    );

    expect(result.current.context).toEqual(lesson);
  });

  it('test_chatbot_context_given_pinned_expect_pinned_wins_over_ambient', () => {
    const { result } = renderHook(
      () => {
        useChatbotPageContext(lesson);
        return useChatbot();
      },
      { wrapper: wrapperWith() },
    );

    act(() => result.current.pin(selection));

    expect(result.current.context).toEqual(selection);
  });

  it('test_chatbot_pin_given_existing_pin_expect_replaced_not_accumulated', () => {
    const { result } = renderChatbot();

    act(() => result.current.pin(selection));
    act(() => result.current.pin(reading));

    expect(result.current.context).toEqual(reading);
  });

  it('test_chatbot_pin_given_conversation_expect_context_note_and_kept_history', () => {
    const { result } = renderChatbot(conversation);

    act(() => result.current.pin(selection));

    expect(result.current.messages).toHaveLength(3);
    expect(result.current.messages.slice(0, 2)).toEqual(conversation);
    expect(result.current.messages[2]).toMatchObject({
      role: 'note',
      content: `Now asking about ${selection.label}`,
    });
  });

  it('test_chatbot_pin_given_empty_conversation_expect_no_context_note', () => {
    const { result } = renderChatbot();

    act(() => result.current.pin(selection));

    expect(result.current.messages).toHaveLength(0);
  });

  it('test_chatbot_pin_given_same_context_expect_no_duplicate_note', () => {
    const { result } = renderChatbot(conversation);

    act(() => result.current.pin(selection));
    act(() => result.current.pin(selection));

    expect(
      result.current.messages.filter((message) => message.role === 'note'),
    ).toHaveLength(1);
  });

  it('test_chatbot_dismiss_given_pinned_expect_fallback_to_ambient', () => {
    const { result } = renderHook(
      () => {
        useChatbotPageContext(lesson);
        return useChatbot();
      },
      { wrapper: wrapperWith() },
    );

    act(() => result.current.pin(selection));
    act(() => result.current.dismissContext());

    expect(result.current.context).toEqual(lesson);
  });

  it('test_chatbot_dismiss_given_ambient_only_expect_no_context', () => {
    const { result } = renderHook(
      () => {
        useChatbotPageContext(lesson);
        return useChatbot();
      },
      { wrapper: wrapperWith() },
    );

    act(() => result.current.dismissContext());

    expect(result.current.context).toBeNull();
  });

  it('test_chatbot_page_context_given_navigation_expect_dismissal_reset', () => {
    const { rerender, result } = renderHook(
      ({ context }: { context: FlytChatbotContext }) => {
        useChatbotPageContext(context);
        return useChatbot();
      },
      { initialProps: { context: lesson }, wrapper: wrapperWith() },
    );

    act(() => result.current.dismissContext());
    expect(result.current.context).toBeNull();

    rerender({ context: reading });

    expect(result.current.context).toEqual(reading);
  });

  it('test_chatbot_page_context_given_unmount_expect_ambient_cleared', () => {
    const { rerender, result } = renderHook(
      ({ mounted }: { mounted: boolean }) => {
        const controls = useChatbot();
        useChatbotPageContext(mounted ? lesson : null);
        return controls;
      },
      { initialProps: { mounted: true }, wrapper: wrapperWith() },
    );

    expect(result.current.context).toEqual(lesson);

    rerender({ mounted: false });

    expect(result.current.context).toBeNull();
  });

  it('test_chatbot_new_conversation_given_messages_expect_cleared', () => {
    const { result } = renderChatbot(conversation);

    act(() => result.current.startNewConversation());

    expect(result.current.messages).toHaveLength(0);
  });

  it('test_chatbot_send_given_draft_expect_user_message_appended', () => {
    const { result } = renderChatbot();

    act(() => result.current.send('Hei', 'flyt'));

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toMatchObject({
      role: 'user',
      content: 'Hei',
    });
  });

  it('test_chatbot_hook_given_no_provider_expect_error', () => {
    expect(() => renderHook(() => useChatbot())).toThrow(
      /must be used within ChatbotProvider/,
    );
  });

  it('test_chatbot_remote_given_surface_and_answer_expect_request_and_response_messages', async () => {
    let requestBody: unknown;
    const initialMessages: readonly FlytChatbotMessage[] = Array.from(
      { length: 14 },
      (_, index) => ({
        id: `turn-${index}`,
        role: index % 2 === 0 ? ('user' as const) : ('chatbot' as const),
        content: `Turn ${index}`,
      }),
    );
    server.use(
      http.get('*/chatbot', () =>
        HttpResponse.json({
          models: [
            {
              id: 'flyt',
              label: 'Flyt',
              detail: 'GLM 5.3 Flash',
              model: 'z-ai/glm-5.3-flash',
              available: true,
              reason: null,
              action: null,
              requiresOpenRouterKey: false,
            },
            {
              id: 'chatgpt',
              label: 'ChatGPT',
              detail: 'powered by Luna',
              model: 'gpt-5.6-luna',
              available: false,
              reason: 'not_linked',
              action: 'link_account',
              requiresOpenRouterKey: false,
            },
            {
              id: 'deepseek',
              label: 'DeepSeek',
              detail: 'via OpenRouter',
              model: 'deepseek/deepseek-v4-flash-0731',
              available: false,
              reason: 'openrouter_key_required',
              action: 'add_openrouter_key',
              requiresOpenRouterKey: true,
            },
            {
              id: 'glm',
              label: 'GLM 5.3 Flash',
              detail: 'via OpenRouter',
              model: 'z-ai/glm-5.3-flash',
              available: false,
              reason: 'openrouter_key_required',
              action: 'add_openrouter_key',
              requiresOpenRouterKey: true,
            },
          ],
          openrouterKeyConfigured: false,
        }),
      ),
      http.post('*/chatbot/messages', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ model: 'flyt', content: 'Svar.' });
      }),
    );

    const { result } = renderHook(() => useChatbot(), {
      wrapper: remoteWrapper(initialMessages),
    });

    act(() => result.current.send('Explain V2', 'flyt'));

    await waitFor(() =>
      expect(result.current.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'chatbot',
            content: 'Svar.',
            model: 'flyt',
          }),
        ]),
      ),
    );
    expect(requestBody).toMatchObject({
      model: 'flyt',
      message: 'Explain V2',
      history: initialMessages.slice(-12).map(({ role, content }) => ({
        role,
        content,
      })),
    });
  });

  it('test_chatbot_remote_given_omitted_models_expect_models_unavailable', async () => {
    server.use(
      http.get('*/chatbot', () =>
        HttpResponse.json({
          models: [
            {
              id: 'flyt',
              label: 'Flyt',
              detail: 'GLM 5.3 Flash',
              model: 'z-ai/glm-5.3-flash',
              available: true,
              reason: null,
              action: null,
              requiresOpenRouterKey: false,
            },
          ],
          openrouterKeyConfigured: false,
        }),
      ),
    );

    const { result } = renderHook(() => useChatbot(), {
      wrapper: remoteWrapper(),
    });

    await waitFor(() =>
      expect(result.current.modelAvailability.flyt?.available).toBe(true),
    );

    expect(result.current.unavailableModels).toEqual([
      'chatgpt',
      'deepseek',
      'glm',
    ]);
  });

  it('test_chatbot_remote_given_long_answer_expect_next_request_history_is_bounded', async () => {
    const requestBodies: ChatbotMessageRequest[] = [];
    const context: FlytChatbotContext = {
      kind: 'lesson',
      label: 'L'.repeat(255),
      detail: 'D'.repeat(1_000),
    };
    const initialMessages: readonly FlytChatbotMessage[] = Array.from(
      { length: 12 },
      (_, index) => ({
        id: `turn-${index}`,
        role: index % 2 === 0 ? ('user' as const) : ('chatbot' as const),
        content: `Turn ${index} ${'x'.repeat(3_993)}`,
      }),
    );
    const longAnswer = 'a'.repeat(4_001);
    let responseCount = 0;
    server.use(
      http.post('*/chatbot/messages', async ({ request }) => {
        requestBodies.push((await request.json()) as ChatbotMessageRequest);
        responseCount += 1;
        return HttpResponse.json({
          model: 'flyt',
          content: responseCount === 1 ? longAnswer : 'Svar.',
        });
      }),
    );

    const { result } = renderHook(() => useChatbot(), {
      wrapper: remoteWrapper(initialMessages),
    });

    act(() => result.current.setPageContext(context));
    act(() => result.current.send('Q'.repeat(4_000), 'flyt'));
    await waitFor(() => expect(result.current.messages).toHaveLength(14));

    act(() => result.current.send('Next question', 'flyt'));
    await waitFor(() => expect(result.current.messages).toHaveLength(16));

    expect(requestBodies).toHaveLength(2);
    for (const requestBody of requestBodies) {
      const historyCharacters = requestBody.history.reduce(
        (total, turn) => total + turn.content.length,
        0,
      );
      const contextCharacters =
        (requestBody.context?.label.length ?? 0) +
        (requestBody.context?.detail?.length ?? 0);
      expect(
        requestBody.message.length + historyCharacters + contextCharacters,
      ).toBeLessThanOrEqual(48_000);
      expect(
        requestBody.history.every((turn) => turn.content.length <= 4_000),
      ).toBe(true);
    }
    expect(requestBodies[1].history).toContainEqual({
      role: 'chatbot',
      content: longAnswer.slice(0, 4_000),
    });
  });

  it('test_chatbot_remote_given_flyt_failure_expect_surface_refreshes_availability', async () => {
    let flytAvailable = true;
    let surfaceRequestCount = 0;
    server.use(
      http.get('*/chatbot', () => {
        surfaceRequestCount += 1;
        return HttpResponse.json({
          models: [
            {
              id: 'flyt',
              label: 'Flyt',
              detail: 'GLM 5.3 Flash',
              model: 'z-ai/glm-5.3-flash',
              available: flytAvailable,
              reason: flytAvailable ? null : 'unavailable',
              action: null,
              requiresOpenRouterKey: false,
            },
          ],
          openrouterKeyConfigured: false,
        });
      }),
      http.post('*/chatbot/messages', () => {
        flytAvailable = false;
        return HttpResponse.json(
          {
            detail: {
              message: 'The selected model could not answer right now.',
              code: 'CHATBOT_PROVIDER_TRANSIENT',
            },
          },
          { status: 503 },
        );
      }),
    );

    const { result } = renderHook(() => useChatbot(), {
      wrapper: remoteWrapper(),
    });

    await waitFor(() =>
      expect(result.current.modelAvailability.flyt?.available).toBe(true),
    );

    act(() => result.current.send('Explain V2', 'flyt'));

    await waitFor(() =>
      expect(result.current.modelAvailability.flyt?.available).toBe(false),
    );
    expect(result.current.unavailableModels).toContain('flyt');
    expect(surfaceRequestCount).toBeGreaterThanOrEqual(2);
  });
});
