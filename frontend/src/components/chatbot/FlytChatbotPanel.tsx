import { useMessageScroller } from '@shadcn/react/message-scroller';
import { Bot, Plus, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { MessageScrollerProvider } from '@/components/chatbot/ui/message-scroller';
import { cn } from '@/lib/utils';

import { formatChatbotLabel, MODEL_ORDER, modelLabel } from './chatbotModels';
import { ChatbotComposer, IconButton } from './FlytChatbotComposer';
import { ChatbotConversationList } from './FlytChatbotConversationList';
import { ChatbotLiveStatus } from './FlytChatbotStatus';
import type {
  FlytChatbotMessage,
  FlytChatbotModel,
  FlytChatbotPanelProps,
} from './types';
import { usePendingFollowUp } from './usePendingFollowUp';

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
  const { scrollToEnd } = useMessageScroller();

  const lastMessage = messages[messages.length - 1];
  const { clearPendingFollow, markSendPending } = usePendingFollowUp({
    draft,
    error,
    isLoading,
    lastMessage,
    messages,
    scrollToEnd,
  });

  const isModelUsable = useCallback(
    (model: FlytChatbotModel) => !unavailableModels.includes(model),
    [unavailableModels],
  );
  const fallbackModel = MODEL_ORDER.find(isModelUsable) ?? null;
  const activeModel = isModelUsable(selectedModel)
    ? selectedModel
    : fallbackModel;
  const canSend = draft.trim().length > 0 && !isLoading && activeModel !== null;
  const hasCompletedAnswer =
    !isLoading && !error && lastMessage?.role === 'chatbot';
  const lastChatbotLabel = formatChatbotLabel(lastMessage, activeModel);
  const availabilityNotice =
    activeModel === null
      ? 'No available model is connected. Connect a model to keep going.'
      : isModelUsable(selectedModel)
        ? null
        : `${modelLabel[selectedModel]} is unavailable — switched to ${modelLabel[activeModel]}`;

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

    if (onSend) {
      markSendPending();
      onSend(message, activeModel);
    }
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
    clearPendingFollow();
    handleDraftChange('');
    onNewConversation?.();
  };

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
      <ChatbotPanelHeader
        onClose={onClose}
        onNewConversation={handleNewConversation}
      />

      <ChatbotLiveStatus
        chatbotLabel={lastChatbotLabel}
        error={error}
        fallbackNotice={availabilityNotice}
        hasCompletedAnswer={hasCompletedAnswer}
        isLoading={isLoading}
        lastMessageId={lastMessage?.id ?? null}
      />

      <ChatbotConversationList
        chatbotLabel={activeModel ? modelLabel[activeModel] : 'Flyt'}
        context={context}
        error={error}
        followUpPrompts={followUpPrompts}
        hasCompletedAnswer={hasCompletedAnswer}
        isLoading={isLoading}
        messages={messages}
        onErrorDismiss={onErrorDismiss}
        onErrorRetry={onErrorRetry}
        onFollowUpSelect={handleFollowUpSelect}
        onStarterSelect={handleStarterSelect}
        onUserInteraction={clearPendingFollow}
        starterPrompts={starterPrompts}
      />

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

function ChatbotPanelHeader({
  onClose,
  onNewConversation,
}: {
  onClose?: () => void;
  onNewConversation: () => void;
}) {
  return (
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
        <IconButton label="New conversation" onClick={onNewConversation}>
          <Plus />
        </IconButton>
        {onClose ? (
          <IconButton label="Close chatbot" onClick={onClose}>
            <X />
          </IconButton>
        ) : null}
      </div>
    </header>
  );
}
