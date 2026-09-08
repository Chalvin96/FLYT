import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

import {
  type ChatbotMessageRequest,
  type ChatbotModelAvailability,
} from '@/api/chatbot';
import {
  getChatbotErrorMessage,
  useChatbotSurface,
  useSendChatbotMessage,
} from '@/hooks/chatbot/queries';

import { buildChatbotHistory } from './buildChatbotHistory';
import {
  type FlytChatbotContext,
  type FlytChatbotMessage,
  type FlytChatbotModel,
} from './FlytChatbotPanel';

export type ChatbotOpenState = 'auto' | 'open' | 'closed';

interface ChatbotState {
  openState: ChatbotOpenState;
  ambientContext: FlytChatbotContext | null;
  pinnedContext: FlytChatbotContext | null;
  isContextDismissed: boolean;
  messages: readonly FlytChatbotMessage[];
}

interface ChatbotStateControls {
  state: ChatbotState;
  stateRef: { current: ChatbotState };
  generationRef: { current: number };
  setState: Dispatch<SetStateAction<ChatbotState>>;
  open(context?: FlytChatbotContext): void;
  close(): void;
  pin(context: FlytChatbotContext): void;
  dismissContext(): void;
  startNewConversation(): void;
  setPageContext(context: FlytChatbotContext | null): void;
}

export interface ChatbotControls {
  openState: ChatbotOpenState;
  context: FlytChatbotContext | null;
  messages: readonly FlytChatbotMessage[];
  unavailableModels: readonly FlytChatbotModel[];
  modelAvailability: Partial<
    Record<FlytChatbotModel, ChatbotModelAvailability>
  >;
  isLoading: boolean;
  error: string | null;
  open(context?: FlytChatbotContext): void;
  close(): void;
  pin(context: FlytChatbotContext): void;
  dismissContext(): void;
  startNewConversation(): void;
  send(message: string, model: FlytChatbotModel): void;
  retry(): void;
  dismissError(): void;
  setPageContext(context: FlytChatbotContext | null): void;
}

const ChatbotControlsContext = createContext<ChatbotControls | null>(null);

const ALL_MODELS: readonly FlytChatbotModel[] = [
  'flyt',
  'chatgpt',
  'deepseek',
  'glm',
];

const isSameContext = (
  a: FlytChatbotContext | null,
  b: FlytChatbotContext | null,
) => a?.kind === b?.kind && a?.label === b?.label && a?.detail === b?.detail;

const resolveContext = (state: ChatbotState) =>
  state.isContextDismissed
    ? null
    : (state.pinnedContext ?? state.ambientContext);

function useChatbotState(
  initialMessages: readonly FlytChatbotMessage[],
  initialOpenState: ChatbotOpenState,
): ChatbotStateControls {
  const [state, setState] = useState<ChatbotState>({
    openState: initialOpenState,
    ambientContext: null,
    pinnedContext: null,
    isContextDismissed: false,
    messages: initialMessages,
  });
  const stateRef = useRef(state);
  const generationRef = useRef(0);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const pin = useCallback((context: FlytChatbotContext) => {
    const noteId = `context-note-${crypto.randomUUID()}`;

    setState((current) => {
      const active = resolveContext(current);
      const next = {
        ...current,
        pinnedContext: context,
        isContextDismissed: false,
      };
      if (isSameContext(active, context) || current.messages.length === 0) {
        return next;
      }

      return {
        ...next,
        messages: [
          ...current.messages,
          {
            id: noteId,
            role: 'note' as const,
            content: `Now asking about ${context.label}`,
          },
        ],
      };
    });
  }, []);

  const open = useCallback(
    (context?: FlytChatbotContext) => {
      setState((current) => ({ ...current, openState: 'open' }));
      if (context) pin(context);
    },
    [pin],
  );

  const close = useCallback(() => {
    setState((current) => ({ ...current, openState: 'closed' }));
  }, []);

  const dismissContext = useCallback(() => {
    setState((current) =>
      current.pinnedContext
        ? { ...current, pinnedContext: null }
        : { ...current, isContextDismissed: true },
    );
  }, []);

  const startNewConversation = useCallback(() => {
    generationRef.current += 1;
    setState((current) => ({ ...current, messages: [] }));
  }, []);

  const setPageContext = useCallback((context: FlytChatbotContext | null) => {
    setState((current) =>
      isSameContext(current.ambientContext, context)
        ? current
        : {
            ...current,
            ambientContext: context,
            isContextDismissed: false,
          },
    );
  }, []);

  return {
    state,
    stateRef,
    generationRef,
    setState,
    open,
    close,
    pin,
    dismissContext,
    startNewConversation,
    setPageContext,
  };
}

interface ChatbotProviderProps {
  children: ReactNode;
  initialMessages?: readonly FlytChatbotMessage[];
  initialOpenState?: ChatbotOpenState;
  remote?: boolean;
}

export function ChatbotProvider({
  children,
  initialMessages = [],
  initialOpenState = 'auto',
  remote = false,
}: ChatbotProviderProps) {
  if (remote) {
    return (
      <RemoteChatbotProvider
        initialMessages={initialMessages}
        initialOpenState={initialOpenState}
      >
        {children}
      </RemoteChatbotProvider>
    );
  }

  return (
    <LocalChatbotProvider
      initialMessages={initialMessages}
      initialOpenState={initialOpenState}
    >
      {children}
    </LocalChatbotProvider>
  );
}

function LocalChatbotProvider({
  children,
  initialMessages,
  initialOpenState,
}: Omit<ChatbotProviderProps, 'remote'>) {
  const chatbot = useChatbotState(
    initialMessages ?? [],
    initialOpenState ?? 'auto',
  );
  const send = useCallback(
    (message: string) => {
      const messageId = `message-${crypto.randomUUID()}`;
      chatbot.setState((current) => ({
        ...current,
        messages: [
          ...current.messages,
          { id: messageId, role: 'user' as const, content: message },
        ],
      }));
    },
    [chatbot],
  );

  const value = useMemo<ChatbotControls>(
    () => ({
      openState: chatbot.state.openState,
      context: resolveContext(chatbot.state),
      messages: chatbot.state.messages,
      unavailableModels: [],
      modelAvailability: {},
      isLoading: false,
      error: null,
      open: chatbot.open,
      close: chatbot.close,
      pin: chatbot.pin,
      dismissContext: chatbot.dismissContext,
      startNewConversation: chatbot.startNewConversation,
      send,
      retry: () => undefined,
      dismissError: () => undefined,
      setPageContext: chatbot.setPageContext,
    }),
    [chatbot, send],
  );

  return (
    <ChatbotControlsContext.Provider value={value}>
      {children}
    </ChatbotControlsContext.Provider>
  );
}

interface PendingChatbotRequest {
  generation: number;
  payload: ChatbotMessageRequest;
}

function RemoteChatbotProvider({
  children,
  initialMessages,
  initialOpenState,
}: Omit<ChatbotProviderProps, 'remote'>) {
  const chatbot = useChatbotState(
    initialMessages ?? [],
    initialOpenState ?? 'auto',
  );
  const surfaceQuery = useChatbotSurface();
  const sendMutation = useSendChatbotMessage();
  const isLoading = sendMutation.isPending;
  const [error, setError] = useState<string | null>(null);
  const pendingRequestRef = useRef<PendingChatbotRequest | null>(null);

  const submit = useCallback(
    (request: PendingChatbotRequest, appendUserMessage: boolean) => {
      if (appendUserMessage) {
        const messageId = `message-${crypto.randomUUID()}`;
        chatbot.setState((current) => ({
          ...current,
          messages: [
            ...current.messages,
            {
              id: messageId,
              role: 'user' as const,
              content: request.payload.message,
            },
          ],
        }));
      }
      pendingRequestRef.current = request;
      setError(null);
      sendMutation.mutate(request.payload, {
        onSuccess: (response) => {
          if (request.generation !== chatbot.generationRef.current) return;
          chatbot.setState((current) => ({
            ...current,
            messages: [
              ...current.messages,
              {
                id: `message-${crypto.randomUUID()}`,
                role: 'chatbot' as const,
                content: response.content,
                model: response.model,
              },
            ],
          }));
          pendingRequestRef.current = null;
          setError(null);
        },
        onError: (requestError) => {
          if (request.generation !== chatbot.generationRef.current) return;
          setError(getChatbotErrorMessage(requestError));
        },
      });
    },
    [chatbot, sendMutation],
  );

  const send = useCallback(
    (message: string, model: FlytChatbotModel) => {
      const context = resolveContext(chatbot.stateRef.current);
      submit(
        {
          generation: chatbot.generationRef.current,
          payload: {
            model,
            message,
            context,
            history: buildChatbotHistory(
              chatbot.stateRef.current.messages,
              message,
              context,
            ),
          },
        },
        true,
      );
    },
    [chatbot, submit],
  );

  const retry = useCallback(() => {
    const request = pendingRequestRef.current;
    if (!request || request.generation !== chatbot.generationRef.current) {
      return;
    }
    submit(request, false);
  }, [chatbot, submit]);

  const startNewConversation = useCallback(() => {
    chatbot.startNewConversation();
    pendingRequestRef.current = null;
    setError(null);
    sendMutation.reset();
  }, [chatbot, sendMutation]);

  const surface = surfaceQuery.data;
  const unavailableModels = surface
    ? ALL_MODELS.filter(
        (model) =>
          !surface.models.some(
            (surfaceModel) =>
              surfaceModel.id === model && surfaceModel.available,
          ),
      )
    : ALL_MODELS;
  const modelAvailability = useMemo(
    () =>
      Object.fromEntries(
        (surface?.models ?? []).map((model) => [model.id, model]),
      ) as Partial<Record<FlytChatbotModel, ChatbotModelAvailability>>,
    [surface?.models],
  );
  const surfaceError = surfaceQuery.isError
    ? 'Chatbot connections could not be loaded. Try again in a moment.'
    : null;

  const value = useMemo<ChatbotControls>(
    () => ({
      openState: chatbot.state.openState,
      context: resolveContext(chatbot.state),
      messages: chatbot.state.messages,
      unavailableModels,
      modelAvailability,
      isLoading,
      error: error ?? surfaceError,
      open: chatbot.open,
      close: chatbot.close,
      pin: chatbot.pin,
      dismissContext: chatbot.dismissContext,
      startNewConversation,
      send,
      retry,
      dismissError: () => setError(null),
      setPageContext: chatbot.setPageContext,
    }),
    [
      chatbot,
      error,
      isLoading,
      modelAvailability,
      retry,
      send,
      startNewConversation,
      surfaceError,
      unavailableModels,
    ],
  );

  return (
    <ChatbotControlsContext.Provider value={value}>
      {children}
    </ChatbotControlsContext.Provider>
  );
}

export function useChatbot(): ChatbotControls {
  const controls = useContext(ChatbotControlsContext);
  if (!controls)
    throw new Error('useChatbot must be used within ChatbotProvider');
  return controls;
}

export function useChatbotPageContext(
  context: FlytChatbotContext | null,
): void {
  const { setPageContext } = useChatbot();
  const kind = context?.kind;
  const label = context?.label;
  const detail = context?.detail;

  useEffect(() => {
    setPageContext(kind && label ? { kind, label, detail } : null);
    return () => setPageContext(null);
  }, [setPageContext, kind, label, detail]);
}
