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
import { MODEL_ORDER } from './chatbotModels';
import { loadRailPreference, writeRailPreference } from './chatbotPreference';
import type {
  ChatbotAvailabilityStatus,
  ChatbotErrorSource,
  ChatbotOpenState,
  FlytChatbotContext,
  FlytChatbotMessage,
  FlytChatbotModel,
} from './types';
import {
  CHATBOT_AVAILABILITY_STATUSES,
  CHATBOT_ERROR_SOURCES,
  CHATBOT_OPEN_STATES,
} from './types';

export type { ChatbotOpenState } from './types';

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
  railOpenPreference: boolean | null;
  open(context?: FlytChatbotContext): void;
  close(): void;
  pin(context: FlytChatbotContext): void;
  dismissContext(): void;
  rememberRailOpen(open: boolean): void;
  startNewConversation(): void;
  setPageContext(context: FlytChatbotContext | null): void;
}

export interface ChatbotControls {
  openState: ChatbotOpenState;
  railOpenPreference: boolean | null;
  context: FlytChatbotContext | null;
  messages: readonly FlytChatbotMessage[];
  unavailableModels: readonly FlytChatbotModel[];
  availabilityStatus: ChatbotAvailabilityStatus;
  modelAvailability: Partial<
    Record<FlytChatbotModel, ChatbotModelAvailability>
  >;
  isLoading: boolean;
  error: string | null;
  errorSource: ChatbotErrorSource | null;
  open(context?: FlytChatbotContext): void;
  close(): void;
  pin(context: FlytChatbotContext): void;
  dismissContext(): void;
  rememberRailOpen(open: boolean): void;
  startNewConversation(): void;
  send(message: string, model: FlytChatbotModel): void;
  retry(): void;
  retryAvailability(): void;
  dismissError(): void;
  setPageContext(context: FlytChatbotContext | null): void;
}

const ChatbotControlsContext = createContext<ChatbotControls | null>(null);

const ANONYMOUS_CHATBOT_SESSION_KEY = 'anonymous';

function buildChatbotSessionKey(
  accountId: string | number | null | undefined,
): string {
  return accountId === null || accountId === undefined
    ? ANONYMOUS_CHATBOT_SESSION_KEY
    : `${typeof accountId}:${String(accountId)}`;
}

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
  accountId: string | number | null | undefined,
): ChatbotStateControls {
  const [state, setState] = useState<ChatbotState>({
    openState: initialOpenState,
    ambientContext: null,
    pinnedContext: null,
    isContextDismissed: false,
    messages: initialMessages,
  });
  const [railOpenPreference, setRailOpenPreference] = useState<boolean | null>(
    () => loadRailPreference(accountId),
  );
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
      setState((current) => ({
        ...current,
        openState: CHATBOT_OPEN_STATES.OPEN,
      }));
      if (context) pin(context);
    },
    [pin],
  );

  const close = useCallback(() => {
    setState((current) => ({
      ...current,
      openState: CHATBOT_OPEN_STATES.CLOSED,
    }));
  }, []);

  const dismissContext = useCallback(() => {
    setState((current) =>
      current.pinnedContext
        ? { ...current, pinnedContext: null }
        : { ...current, isContextDismissed: true },
    );
  }, []);

  const rememberRailOpen = useCallback(
    (open: boolean) => {
      writeRailPreference(accountId, open);
      setRailOpenPreference(open);
    },
    [accountId],
  );

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
    railOpenPreference,
    open,
    close,
    pin,
    dismissContext,
    rememberRailOpen,
    startNewConversation,
    setPageContext,
  };
}

interface ChatbotProviderProps {
  children: ReactNode;
  accountId?: string | number | null;
  initialMessages?: readonly FlytChatbotMessage[];
  initialOpenState?: ChatbotOpenState;
  remote?: boolean;
}

export function ChatbotProvider({
  children,
  accountId = null,
  initialMessages = [],
  initialOpenState = CHATBOT_OPEN_STATES.AUTO,
  remote = false,
}: ChatbotProviderProps) {
  const [session, setSession] = useState(() => ({
    accountId,
    initialMessages,
    initialOpenState,
  }));
  if (session.accountId !== accountId) {
    setSession({
      accountId,
      initialMessages: [],
      initialOpenState: CHATBOT_OPEN_STATES.AUTO,
    });
  }

  const sessionKey = buildChatbotSessionKey(accountId);
  const sessionMessages = session.initialMessages;
  const sessionOpenState = session.initialOpenState;

  if (remote) {
    return (
      <RemoteChatbotProvider
        accountId={accountId}
        initialMessages={sessionMessages}
        initialOpenState={sessionOpenState}
        key={sessionKey}
      >
        {children}
      </RemoteChatbotProvider>
    );
  }

  return (
    <LocalChatbotProvider
      accountId={accountId}
      initialMessages={sessionMessages}
      initialOpenState={sessionOpenState}
      key={sessionKey}
    >
      {children}
    </LocalChatbotProvider>
  );
}

function LocalChatbotProvider({
  accountId,
  children,
  initialMessages,
  initialOpenState,
}: Omit<ChatbotProviderProps, 'remote'>) {
  const chatbot = useChatbotState(
    initialMessages ?? [],
    initialOpenState ?? CHATBOT_OPEN_STATES.AUTO,
    accountId,
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
      railOpenPreference: chatbot.railOpenPreference,
      context: resolveContext(chatbot.state),
      messages: chatbot.state.messages,
      unavailableModels: [],
      availabilityStatus: CHATBOT_AVAILABILITY_STATUSES.READY,
      modelAvailability: {},
      isLoading: false,
      error: null,
      errorSource: null,
      open: chatbot.open,
      close: chatbot.close,
      pin: chatbot.pin,
      dismissContext: chatbot.dismissContext,
      rememberRailOpen: chatbot.rememberRailOpen,
      startNewConversation: chatbot.startNewConversation,
      send,
      retry: () => undefined,
      retryAvailability: () => undefined,
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
  accountId,
  children,
  initialMessages,
  initialOpenState,
}: Omit<ChatbotProviderProps, 'remote'>) {
  const chatbot = useChatbotState(
    initialMessages ?? [],
    initialOpenState ?? CHATBOT_OPEN_STATES.AUTO,
    accountId,
  );
  const surfaceQuery = useChatbotSurface(accountId);
  const sendMutation = useSendChatbotMessage(accountId);
  const isLoading = sendMutation.isPending;
  const [requestError, setRequestError] = useState<string | null>(null);
  const [dismissedSurfaceErrorAt, setDismissedSurfaceErrorAt] = useState<
    number | null
  >(null);
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
      if (appendUserMessage) setRequestError(null);
      setDismissedSurfaceErrorAt(null);
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
          setRequestError(null);
        },
        onError: (requestError) => {
          if (request.generation !== chatbot.generationRef.current) return;
          setRequestError(getChatbotErrorMessage(requestError));
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
    setRequestError(null);
    setDismissedSurfaceErrorAt(null);
    sendMutation.reset();
  }, [chatbot, sendMutation]);

  const surface = surfaceQuery.data;
  const availabilityStatus: ChatbotAvailabilityStatus = surfaceQuery.isError
    ? CHATBOT_AVAILABILITY_STATUSES.ERROR
    : surface
      ? CHATBOT_AVAILABILITY_STATUSES.READY
      : CHATBOT_AVAILABILITY_STATUSES.LOADING;
  const refetchSurface = surfaceQuery.refetch;
  const retryAvailability = useCallback(() => {
    setDismissedSurfaceErrorAt(null);
    void refetchSurface();
  }, [refetchSurface]);
  const unavailableModels =
    availabilityStatus === CHATBOT_AVAILABILITY_STATUSES.ERROR
      ? MODEL_ORDER
      : surface
        ? MODEL_ORDER.filter(
            (model) =>
              !surface.models.some(
                (surfaceModel) =>
                  surfaceModel.id === model && surfaceModel.available,
              ),
          )
        : MODEL_ORDER;
  const modelAvailability = useMemo(
    () =>
      availabilityStatus === CHATBOT_AVAILABILITY_STATUSES.ERROR
        ? {}
        : (Object.fromEntries(
            (surface?.models ?? []).map((model) => [model.id, model]),
          ) as Partial<Record<FlytChatbotModel, ChatbotModelAvailability>>),
    [availabilityStatus, surface?.models],
  );
  const surfaceError =
    surfaceQuery.isError &&
    surfaceQuery.errorUpdatedAt !== dismissedSurfaceErrorAt
      ? 'Chatbot connections could not be loaded. Try again in a moment.'
      : null;
  const error = requestError ?? surfaceError;
  const errorSource: ChatbotErrorSource | null = requestError
    ? CHATBOT_ERROR_SOURCES.REQUEST
    : surfaceError
      ? CHATBOT_ERROR_SOURCES.AVAILABILITY
      : null;
  const dismissError = useCallback(() => {
    if (requestError) {
      setRequestError(null);
      return;
    }
    if (surfaceError) {
      setDismissedSurfaceErrorAt(surfaceQuery.errorUpdatedAt);
    }
  }, [requestError, surfaceError, surfaceQuery.errorUpdatedAt]);

  const value = useMemo<ChatbotControls>(
    () => ({
      openState: chatbot.state.openState,
      railOpenPreference: chatbot.railOpenPreference,
      context: resolveContext(chatbot.state),
      messages: chatbot.state.messages,
      unavailableModels,
      availabilityStatus,
      modelAvailability,
      isLoading,
      error,
      errorSource,
      open: chatbot.open,
      close: chatbot.close,
      pin: chatbot.pin,
      dismissContext: chatbot.dismissContext,
      rememberRailOpen: chatbot.rememberRailOpen,
      startNewConversation,
      send,
      retry,
      retryAvailability,
      dismissError,
      setPageContext: chatbot.setPageContext,
    }),
    [
      availabilityStatus,
      chatbot,
      dismissError,
      error,
      errorSource,
      isLoading,
      modelAvailability,
      retry,
      retryAvailability,
      send,
      startNewConversation,
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
