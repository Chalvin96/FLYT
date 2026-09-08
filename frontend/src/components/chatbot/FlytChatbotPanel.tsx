import { useMessageScroller } from '@shadcn/react/message-scroller';
import { Bot, Plus, X } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/chatbot/ui/message-scroller';
import { ErrorMessage } from '@/components/common/ErrorMessage/ErrorMessage';
import { cn } from '@/lib/utils';

import { formatChatbotLabel, MODEL_ORDER, modelLabel } from './chatbotModels';
import { ChatbotComposer, IconButton } from './FlytChatbotComposer';
import { ContextNote } from './FlytChatbotContextElements';
import { FollowUpActions, MessageRow } from './FlytChatbotConversation';
import { EmptyState } from './FlytChatbotEmptyState';
import { ChatbotLiveStatus, LoadingStatus } from './FlytChatbotStatus';
import type {
  FlytChatbotMessage,
  FlytChatbotModel,
  FlytChatbotPanelProps,
} from './types';

export type {
  FlytChatbotContext,
  FlytChatbotContextKind,
  FlytChatbotMessage,
  FlytChatbotModel,
  FlytChatbotPanelProps,
  FlytChatbotSurface,
} from './types';
const DEFAULT_STARTER_PROMPTS = [
  'Explain this simply',
  'Give me an example',
  'What should I practice next?',
];

const EMPTY_MESSAGES: readonly FlytChatbotMessage[] = [];

const EMPTY_MODELS: readonly FlytChatbotModel[] = [];

const EMPTY_PROMPTS: readonly string[] = [];

const EMPTY_MODEL_REASONS: Partial<Record<FlytChatbotModel, string | null>> =
  {};

const EMPTY_MODEL_ACTIONS: Partial<Record<FlytChatbotModel, string | null>> =
  {};

const MESSAGE_SCROLL_EDGE_THRESHOLD_PX = 96;

const MESSAGE_SCROLL_INTENT_KEYS = new Set([
  'ArrowDown',
  'ArrowUp',
  'End',
  'Home',
  'PageDown',
  'PageUp',
  ' ',
]);

export function FlytChatbotPanel(props: FlytChatbotPanelProps) {
  return (
    <MessageScrollerProvider
      autoScroll
      scrollEdgeThreshold={MESSAGE_SCROLL_EDGE_THRESHOLD_PX}
    >
      <FlytChatbotPanelContent {...props} />
    </MessageScrollerProvider>
  );
}

function FlytChatbotPanelContent({
  context = null,
  messages = EMPTY_MESSAGES,
  defaultModel = 'flyt',
  selectedModel: controlledSelectedModel,
  onSelectedModelChange,
  draft: controlledDraft,
  onDraftChange,
  surface = 'card',
  unavailableModels = EMPTY_MODELS,
  modelReasons = EMPTY_MODEL_REASONS,
  modelActions = EMPTY_MODEL_ACTIONS,
  flytRemainingPercent = null,
  starterPrompts = DEFAULT_STARTER_PROMPTS,
  followUpPrompts = EMPTY_PROMPTS,
  isLoading = false,
  error = null,
  className,
  onClose,
  onContextRemove,
  onErrorDismiss,
  onErrorRetry,
  onModelChange,
  onNewConversation,
  onSend,
  onStarterSelect,
  onFollowUpSelect,
}: FlytChatbotPanelProps) {
  const [internalDraft, setInternalDraft] = useState('');
  const [internalSelectedModel, setInternalSelectedModel] =
    useState(defaultModel);
  const draft = controlledDraft ?? internalDraft;
  const selectedModel = controlledSelectedModel ?? internalSelectedModel;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingFollowRef = useRef<{
    messageCount: number;
    error: string | null;
  } | null>(null);
  const { scrollToEnd } = useMessageScroller();
  const isModelUsable = (model: FlytChatbotModel) =>
    !unavailableModels.includes(model);
  const fallbackModel = MODEL_ORDER.find(isModelUsable) ?? null;
  const activeModel = isModelUsable(selectedModel)
    ? selectedModel
    : fallbackModel;
  const canSend = draft.trim().length > 0 && !isLoading && activeModel !== null;
  const lastMessage = messages[messages.length - 1];
  const hasCompletedAnswer =
    !isLoading && !error && lastMessage?.role === 'chatbot';
  const lastChatbotLabel = formatChatbotLabel(lastMessage, activeModel);

  useLayoutEffect(() => {
    const pendingFollow = pendingFollowRef.current;
    if (!pendingFollow) return;

    scrollToEnd({ behavior: 'auto' });

    const hasNewError = Boolean(error && error !== pendingFollow.error);
    const hasCompletedNewAnswer =
      messages.length > pendingFollow.messageCount &&
      !isLoading &&
      lastMessage?.role === 'chatbot';
    if (hasNewError || hasCompletedNewAnswer) {
      pendingFollowRef.current = null;
    }
  }, [draft, error, isLoading, lastMessage?.role, messages, scrollToEnd]);

  const handleModelChange = (model: FlytChatbotModel) => {
    setInternalSelectedModel(model);
    onSelectedModelChange?.(model);
    onModelChange?.(model);
  };

  const handleDraftChange = (value: string) => {
    setInternalDraft(value);
    onDraftChange?.(value);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || !canSend || !activeModel) return;

    if (!onSend) {
      handleDraftChange('');
      return;
    }

    pendingFollowRef.current = {
      error,
      messageCount: messages.length,
    };
    onSend(message, activeModel);
    handleDraftChange('');
  };

  const handleStarterSelect = (prompt: string) => {
    handleDraftChange(prompt);
    onStarterSelect?.(prompt);
    textareaRef.current?.focus();
  };

  const handleFollowUpSelect = (prompt: string) => {
    handleDraftChange(prompt);
    onFollowUpSelect?.(prompt);
    textareaRef.current?.focus();
  };

  const handleNewConversation = () => {
    pendingFollowRef.current = null;
    handleDraftChange('');
    onNewConversation?.();
  };

  const handleViewportInteraction = () => {
    pendingFollowRef.current = null;
  };

  const handleViewportKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (MESSAGE_SCROLL_INTENT_KEYS.has(event.key)) {
      handleViewportInteraction();
    }
  };

  const availabilityNotice =
    activeModel === null
      ? 'No available model is connected. Connect a model to keep going.'
      : isModelUsable(selectedModel)
        ? null
        : `${modelLabel[selectedModel]} is unavailable — switched to ${modelLabel[activeModel]}`;

  return (
    <section
      aria-label="Ask Flyt"
      className={cn(
        'grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden @container',
        surface === 'pane'
          ? 'bg-card text-card-foreground'
          : 'radius-section border border-border bg-card text-card-foreground shadow-soft',
        className,
      )}
      data-testid="flyt-chatbot-panel"
    >
      <header className="flex min-h-14 min-w-0 shrink-0 items-center justify-between gap-2 border-b border-border/70 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-5 text-primary-70 @max-[360px]:hidden">
            <Bot aria-hidden="true" className="icon-sm" strokeWidth={1.8} />
          </span>
          <h2 className="min-w-0 truncate font-display type-body font-semibold text-foreground">
            Ask Flyt
          </h2>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton label="New conversation" onClick={handleNewConversation}>
            <Plus />
          </IconButton>
          {onClose ? (
            <IconButton label="Close chatbot" onClick={onClose}>
              <X />
            </IconButton>
          ) : null}
        </div>
      </header>

      <ChatbotLiveStatus
        chatbotLabel={lastChatbotLabel}
        error={error}
        fallbackNotice={availabilityNotice}
        hasCompletedAnswer={hasCompletedAnswer}
        isLoading={isLoading}
        lastMessageId={lastMessage?.id ?? null}
      />

      <div className="relative min-h-0 min-w-0 bg-card">
        <MessageScroller>
          <MessageScrollerViewport
            aria-label="Messages"
            className="h-full"
            data-testid="chatbot-messages"
            onKeyDown={handleViewportKeyDown}
            onTouchMove={handleViewportInteraction}
            onWheel={handleViewportInteraction}
            style={{ overflowAnchor: 'none' }}
          >
            <MessageScrollerContent
              aria-busy={isLoading}
              aria-label="Conversation"
              aria-live="off"
              className="gap-0 px-4 pt-6 pb-5 sm:px-5"
            >
              {messages.map((message, messageIndex) => {
                const previous = messages[messageIndex - 1];
                const continuesExchange =
                  previous?.role === 'user' && message.role === 'chatbot';

                return (
                  <MessageScrollerItem
                    className={
                      message.role === 'note'
                        ? undefined
                        : messageIndex === 0
                          ? undefined
                          : continuesExchange
                            ? 'mt-3'
                            : 'mt-7'
                    }
                    key={message.id}
                    messageId={message.id}
                  >
                    {message.role === 'note' ? (
                      <ContextNote message={message} />
                    ) : (
                      <MessageRow
                        chatbotLabel={
                          activeModel ? modelLabel[activeModel] : 'Flyt'
                        }
                        message={message}
                      />
                    )}
                  </MessageScrollerItem>
                );
              })}
              {isLoading && messages.length > 0 ? (
                <MessageScrollerItem messageId="chatbot-loading">
                  <LoadingStatus className="mt-3" />
                </MessageScrollerItem>
              ) : null}
              {hasCompletedAnswer ? (
                <MessageScrollerItem messageId="chatbot-follow-ups">
                  <FollowUpActions
                    onPromptSelect={handleFollowUpSelect}
                    prompts={followUpPrompts}
                  />
                </MessageScrollerItem>
              ) : null}
              {error ? (
                <MessageScrollerItem messageId="chatbot-error">
                  <ErrorMessage
                    className="mt-4 max-w-full"
                    error={error}
                    onDismiss={onErrorDismiss}
                    onRetry={onErrorRetry}
                    role="none"
                    title="Unable to answer"
                  />
                </MessageScrollerItem>
              ) : null}
              {messages.length === 0 && !isLoading ? (
                <MessageScrollerItem
                  className="flex min-h-full flex-1"
                  messageId="chatbot-empty"
                >
                  <EmptyState
                    context={context}
                    prompts={starterPrompts}
                    onPromptSelect={handleStarterSelect}
                  />
                </MessageScrollerItem>
              ) : null}
              {messages.length === 0 && isLoading ? (
                <MessageScrollerItem
                  className="flex min-h-64 flex-1 items-center justify-center"
                  messageId="chatbot-loading-empty"
                >
                  <LoadingStatus />
                </MessageScrollerItem>
              ) : null}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </div>

      <ChatbotComposer
        activeModel={activeModel}
        composerState={{
          canSend,
          loading: isLoading,
          availabilityNotice,
        }}
        context={context}
        draft={draft}
        flytRemainingPercent={flytRemainingPercent}
        isModelUsable={isModelUsable}
        modelActions={modelActions}
        modelReasons={modelReasons}
        onContextRemove={onContextRemove}
        onDraftChange={handleDraftChange}
        onModelChange={handleModelChange}
        onSubmit={handleSubmit}
        textareaRef={textareaRef}
      />
    </section>
  );
}
