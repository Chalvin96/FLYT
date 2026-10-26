import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  CHATBOT_MODEL_ACTIONS,
  CHATBOT_MODEL_IDS,
  CHATBOT_MODEL_REASONS,
  type ChatbotMessageRequest,
} from '@/api/chatbot';
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
import {
  CHATBOT_AVAILABILITY_STATUSES,
  CHATBOT_ERROR_SOURCES,
  CHATBOT_OPEN_STATES,
} from './types';

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

function AccountHarness() {
  const { messages, openState } = useChatbot();
  const [draft, setDraft] = useState('');

  return (
    <div>
      <span data-testid="message-count">{messages.length}</span>
      <span data-testid="open-state">{openState}</span>
      <input
        data-testid="account-draft"
        onChange={(event) => setDraft(event.target.value)}
        value={draft}
      />
    </div>
  );
}

function PreferenceHarness() {
  const { rememberRailOpen } = useChatbot();

  return (
    <button onClick={() => rememberRailOpen(true)} type="button">
      Remember rail
    </button>
  );
}

describe('ChatbotProvider', () => {
  it('test_chatbot_provider_given_account_change_expect_history_and_open_state_reset', () => {
    const view = render(
      <ChatbotProvider
        accountId={1}
        initialMessages={conversation}
        initialOpenState={CHATBOT_OPEN_STATES.OPEN}
      >
        <AccountHarness />
      </ChatbotProvider>,
    );

    expect(screen.getByTestId('message-count')).toHaveTextContent('2');
    expect(screen.getByTestId('open-state')).toHaveTextContent(
      CHATBOT_OPEN_STATES.OPEN,
    );
    fireEvent.change(screen.getByTestId('account-draft'), {
      target: { value: 'prior account draft' },
    });

    view.rerender(
      <ChatbotProvider
        accountId={2}
        initialMessages={conversation}
        initialOpenState={CHATBOT_OPEN_STATES.OPEN}
      >
        <AccountHarness />
      </ChatbotProvider>,
    );

    expect(screen.getByTestId('message-count')).toHaveTextContent('0');
    expect(screen.getByTestId('open-state')).toHaveTextContent(
      CHATBOT_OPEN_STATES.AUTO,
    );
    expect(screen.getByTestId('account-draft')).toHaveValue('');

    view.rerender(
      <ChatbotProvider
        accountId={1}
        initialMessages={conversation}
        initialOpenState={CHATBOT_OPEN_STATES.OPEN}
      >
        <AccountHarness />
      </ChatbotProvider>,
    );

    expect(screen.getByTestId('message-count')).toHaveTextContent('0');
    expect(screen.getByTestId('open-state')).toHaveTextContent(
      CHATBOT_OPEN_STATES.AUTO,
    );
    expect(screen.getByTestId('account-draft')).toHaveValue('');
  });

  it('test_chatbot_provider_given_account_change_expect_preferences_remain_scoped', () => {
    const view = render(
      <ChatbotProvider accountId={1}>
        <PreferenceHarness />
      </ChatbotProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remember rail' }));
    expect(window.localStorage.getItem('flyt.chatbot.rail-preference:1')).toBe(
      CHATBOT_OPEN_STATES.OPEN,
    );

    view.rerender(
      <ChatbotProvider accountId={2}>
        <PreferenceHarness />
      </ChatbotProvider>,
    );

    expect(window.localStorage.getItem('flyt.chatbot.rail-preference:1')).toBe(
      CHATBOT_OPEN_STATES.OPEN,
    );
    expect(
      window.localStorage.getItem('flyt.chatbot.rail-preference:2'),
    ).toBeNull();
  });

  it('test_chatbot_open_state_given_no_action_expect_auto', () => {
    const { result } = renderChatbot();

    expect(result.current.openState).toBe(CHATBOT_OPEN_STATES.AUTO);
    expect(result.current.context).toBeNull();
  });

  it('test_chatbot_open_given_context_expect_open_and_pinned', () => {
    const { result } = renderChatbot();

    act(() => result.current.open(selection));

    expect(result.current.openState).toBe(CHATBOT_OPEN_STATES.OPEN);
    expect(result.current.context).toEqual(selection);
  });

  it('test_chatbot_close_given_open_expect_closed_state', () => {
    const { result } = renderChatbot();

    act(() => result.current.open());
    act(() => result.current.close());

    expect(result.current.openState).toBe(CHATBOT_OPEN_STATES.CLOSED);
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

    act(() => result.current.send('Hei', CHATBOT_MODEL_IDS.FLYT));

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
              id: CHATBOT_MODEL_IDS.FLYT,
              label: 'Flyt',
              detail: 'GLM 5.3 Flash',
              model: 'z-ai/glm-5.3-flash',
              available: true,
              reason: null,
              action: null,
              requiresOpenRouterKey: false,
            },
            {
              id: CHATBOT_MODEL_IDS.CHATGPT,
              label: 'ChatGPT',
              detail: 'powered by Luna',
              model: 'gpt-5.6-luna',
              available: false,
              reason: CHATBOT_MODEL_REASONS.NOT_LINKED,
              action: CHATBOT_MODEL_ACTIONS.LINK_ACCOUNT,
              requiresOpenRouterKey: false,
            },
            {
              id: CHATBOT_MODEL_IDS.DEEPSEEK,
              label: 'DeepSeek',
              detail: 'via OpenRouter',
              model: 'deepseek/deepseek-v4-flash-0731',
              available: false,
              reason: CHATBOT_MODEL_REASONS.OPENROUTER_KEY_REQUIRED,
              action: CHATBOT_MODEL_ACTIONS.ADD_OPENROUTER_KEY,
              requiresOpenRouterKey: true,
            },
            {
              id: CHATBOT_MODEL_IDS.GLM,
              label: 'GLM 5.3 Flash',
              detail: 'via OpenRouter',
              model: 'z-ai/glm-5.3-flash',
              available: false,
              reason: CHATBOT_MODEL_REASONS.OPENROUTER_KEY_REQUIRED,
              action: CHATBOT_MODEL_ACTIONS.ADD_OPENROUTER_KEY,
              requiresOpenRouterKey: true,
            },
          ],
          openrouterKeyConfigured: false,
        }),
      ),
      http.post('*/chatbot/messages', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({
          model: CHATBOT_MODEL_IDS.FLYT,
          content: 'Svar.',
        });
      }),
    );

    const { result } = renderHook(() => useChatbot(), {
      wrapper: remoteWrapper(initialMessages),
    });

    act(() => result.current.send('Explain V2', CHATBOT_MODEL_IDS.FLYT));

    await waitFor(() =>
      expect(result.current.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'chatbot',
            content: 'Svar.',
            model: CHATBOT_MODEL_IDS.FLYT,
          }),
        ]),
      ),
    );
    expect(requestBody).toMatchObject({
      model: CHATBOT_MODEL_IDS.FLYT,
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
              id: CHATBOT_MODEL_IDS.FLYT,
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
      expect(
        result.current.modelAvailability[CHATBOT_MODEL_IDS.FLYT]?.available,
      ).toBe(true),
    );

    expect(result.current.unavailableModels).toEqual([
      CHATBOT_MODEL_IDS.CHATGPT,
      CHATBOT_MODEL_IDS.DEEPSEEK,
      CHATBOT_MODEL_IDS.GLM,
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
          model: CHATBOT_MODEL_IDS.FLYT,
          content: responseCount === 1 ? longAnswer : 'Svar.',
        });
      }),
    );

    const { result } = renderHook(() => useChatbot(), {
      wrapper: remoteWrapper(initialMessages),
    });

    act(() => result.current.setPageContext(context));
    act(() => result.current.send('Q'.repeat(4_000), CHATBOT_MODEL_IDS.FLYT));
    await waitFor(() => expect(result.current.messages).toHaveLength(14));

    act(() => result.current.send('Next question', CHATBOT_MODEL_IDS.FLYT));
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
              id: CHATBOT_MODEL_IDS.FLYT,
              label: 'Flyt',
              detail: 'GLM 5.3 Flash',
              model: 'z-ai/glm-5.3-flash',
              available: flytAvailable,
              reason: flytAvailable ? null : CHATBOT_MODEL_REASONS.UNAVAILABLE,
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
      expect(
        result.current.modelAvailability[CHATBOT_MODEL_IDS.FLYT]?.available,
      ).toBe(true),
    );

    act(() => result.current.send('Explain V2', CHATBOT_MODEL_IDS.FLYT));

    await waitFor(() =>
      expect(
        result.current.modelAvailability[CHATBOT_MODEL_IDS.FLYT]?.available,
      ).toBe(false),
    );
    expect(result.current.unavailableModels).toContain(CHATBOT_MODEL_IDS.FLYT);
    expect(surfaceRequestCount).toBeGreaterThanOrEqual(2);
  });

  it('test_chatbot_remote_given_cached_surface_refetch_failure_expect_error_state', async () => {
    let surfaceRequestCount = 0;
    server.use(
      http.get('*/chatbot', () => {
        surfaceRequestCount += 1;
        if (surfaceRequestCount > 1) {
          return HttpResponse.json(
            { detail: { message: 'temporary outage' } },
            { status: 503 },
          );
        }
        return HttpResponse.json({
          models: [
            {
              id: CHATBOT_MODEL_IDS.FLYT,
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
        });
      }),
    );

    const { result } = renderHook(() => useChatbot(), {
      wrapper: remoteWrapper(),
    });

    await waitFor(() =>
      expect(result.current.availabilityStatus).toBe(
        CHATBOT_AVAILABILITY_STATUSES.READY,
      ),
    );
    act(() => result.current.retryAvailability());

    await waitFor(() =>
      expect(result.current.availabilityStatus).toBe(
        CHATBOT_AVAILABILITY_STATUSES.ERROR,
      ),
    );
    expect(result.current.unavailableModels).toEqual([
      CHATBOT_MODEL_IDS.FLYT,
      CHATBOT_MODEL_IDS.CHATGPT,
      CHATBOT_MODEL_IDS.DEEPSEEK,
      CHATBOT_MODEL_IDS.GLM,
    ]);
    expect(result.current.error).toContain('could not be loaded');
    expect(result.current.errorSource).toBe(CHATBOT_ERROR_SOURCES.AVAILABILITY);

    act(() => result.current.dismissError());
    expect(result.current.error).toBeNull();
    expect(result.current.errorSource).toBeNull();
  });

  it('test_chatbot_remote_given_request_and_surface_failures_expect_request_recovery_remains_primary', async () => {
    let surfaceRequestCount = 0;
    let sendRequestCount = 0;
    server.use(
      http.get('*/chatbot', () => {
        surfaceRequestCount += 1;
        if (surfaceRequestCount > 1) {
          return HttpResponse.json(
            { detail: { message: 'temporary outage' } },
            { status: 503 },
          );
        }
        return HttpResponse.json({
          models: [
            {
              id: CHATBOT_MODEL_IDS.FLYT,
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
        });
      }),
      http.post('*/chatbot/messages', () => {
        sendRequestCount += 1;
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
      expect(result.current.availabilityStatus).toBe(
        CHATBOT_AVAILABILITY_STATUSES.READY,
      ),
    );

    act(() => result.current.send('Explain V2', CHATBOT_MODEL_IDS.FLYT));

    await waitFor(() =>
      expect(result.current.errorSource).toBe(CHATBOT_ERROR_SOURCES.REQUEST),
    );
    await waitFor(() =>
      expect(result.current.availabilityStatus).toBe(
        CHATBOT_AVAILABILITY_STATUSES.ERROR,
      ),
    );
    expect(result.current.error).toContain(
      'The selected model could not answer right now.',
    );
    expect(sendRequestCount).toBe(1);

    act(() => result.current.retry());

    await waitFor(() => expect(sendRequestCount).toBe(2));
  });
});
