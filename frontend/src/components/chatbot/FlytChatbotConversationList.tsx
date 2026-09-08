import type { KeyboardEvent } from 'react';

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerViewport,
} from '@/components/chatbot/ui/message-scroller';
import { ErrorMessage } from '@/components/common/ErrorMessage/ErrorMessage';

import { ContextNote } from './FlytChatbotContextElements';
import { FollowUpActions, MessageRow } from './FlytChatbotConversation';
import { EmptyState } from './FlytChatbotEmptyState';
import { LoadingStatus } from './FlytChatbotStatus';
import type { FlytChatbotContext, FlytChatbotMessage } from './types';

const MESSAGE_SCROLL_INTENT_KEYS = new Set([
  'ArrowDown',
  'ArrowUp',
  'End',
  'Home',
  'PageDown',
  'PageUp',
  ' ',
]);

export function ChatbotConversationList({
  chatbotLabel,
  context,
  error,
  followUpPrompts,
  hasCompletedAnswer,
  isLoading,
  messages,
  onErrorDismiss,
  onErrorRetry,
  onFollowUpSelect,
  onStarterSelect,
  onUserInteraction,
  starterPrompts,
}: {
  chatbotLabel: string;
  context: FlytChatbotContext | null;
  error: string | null;
  followUpPrompts: readonly string[];
  hasCompletedAnswer: boolean;
  isLoading: boolean;
  messages: readonly FlytChatbotMessage[];
  onErrorDismiss?: () => void;
  onErrorRetry?: () => void;
  onFollowUpSelect: (prompt: string) => void;
  onStarterSelect: (prompt: string) => void;
  onUserInteraction: () => void;
  starterPrompts: readonly string[];
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (MESSAGE_SCROLL_INTENT_KEYS.has(event.key)) {
      onUserInteraction();
    }
  };

  return (
    <div className="relative min-h-0 min-w-0 bg-card">
      <MessageScroller>
        <MessageScrollerViewport
          aria-label="Messages"
          className="h-full"
          data-testid="chatbot-messages"
          onKeyDown={handleKeyDown}
          onTouchMove={onUserInteraction}
          onWheel={onUserInteraction}
          style={{ overflowAnchor: 'none' }}
        >
          <MessageScrollerContent
            aria-busy={isLoading}
            aria-label="Conversation"
            aria-live="off"
            className="gap-0 px-4 pt-6 pb-5 sm:px-5"
          >
            {messages.map((message, messageIndex) => (
              <ConversationItem
                chatbotLabel={chatbotLabel}
                key={message.id}
                message={message}
                previous={messages[messageIndex - 1]}
                showExchangeSpacing={messageIndex > 0}
              />
            ))}
            <ConversationStatusItems
              error={error}
              followUpPrompts={followUpPrompts}
              hasCompletedAnswer={hasCompletedAnswer}
              isLoading={isLoading}
              hasMessages={messages.length > 0}
              onErrorDismiss={onErrorDismiss}
              onErrorRetry={onErrorRetry}
              onFollowUpSelect={onFollowUpSelect}
            />
            <ConversationEmptyItems
              context={context}
              hasMessages={messages.length > 0}
              isLoading={isLoading}
              onStarterSelect={onStarterSelect}
              starterPrompts={starterPrompts}
            />
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </div>
  );
}

function ConversationItem({
  chatbotLabel,
  message,
  previous,
  showExchangeSpacing,
}: {
  chatbotLabel: string;
  message: FlytChatbotMessage;
  previous: FlytChatbotMessage | undefined;
  showExchangeSpacing: boolean;
}) {
  const continuesExchange =
    previous?.role === 'user' && message.role === 'chatbot';

  return (
    <MessageScrollerItem
      className={
        message.role === 'note' || !showExchangeSpacing
          ? undefined
          : continuesExchange
            ? 'mt-3'
            : 'mt-7'
      }
      messageId={message.id}
    >
      {message.role === 'note' ? (
        <ContextNote message={message} />
      ) : (
        <MessageRow chatbotLabel={chatbotLabel} message={message} />
      )}
    </MessageScrollerItem>
  );
}

function ConversationStatusItems({
  error,
  followUpPrompts,
  hasCompletedAnswer,
  hasMessages,
  isLoading,
  onErrorDismiss,
  onErrorRetry,
  onFollowUpSelect,
}: {
  error: string | null;
  followUpPrompts: readonly string[];
  hasCompletedAnswer: boolean;
  hasMessages: boolean;
  isLoading: boolean;
  onErrorDismiss?: () => void;
  onErrorRetry?: () => void;
  onFollowUpSelect: (prompt: string) => void;
}) {
  return (
    <>
      {isLoading && hasMessages ? (
        <MessageScrollerItem messageId="chatbot-loading">
          <LoadingStatus className="mt-3" />
        </MessageScrollerItem>
      ) : null}
      {hasCompletedAnswer ? (
        <MessageScrollerItem messageId="chatbot-follow-ups">
          <FollowUpActions
            onPromptSelect={onFollowUpSelect}
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
    </>
  );
}

function ConversationEmptyItems({
  context,
  hasMessages,
  isLoading,
  onStarterSelect,
  starterPrompts,
}: {
  context: FlytChatbotContext | null;
  hasMessages: boolean;
  isLoading: boolean;
  onStarterSelect: (prompt: string) => void;
  starterPrompts: readonly string[];
}) {
  if (hasMessages) {
    return null;
  }

  if (isLoading) {
    return (
      <MessageScrollerItem
        className="flex min-h-64 flex-1 items-center justify-center"
        messageId="chatbot-loading-empty"
      >
        <LoadingStatus />
      </MessageScrollerItem>
    );
  }

  return (
    <MessageScrollerItem
      className="flex min-h-full flex-1"
      messageId="chatbot-empty"
    >
      <EmptyState
        context={context}
        onPromptSelect={onStarterSelect}
        prompts={starterPrompts}
      />
    </MessageScrollerItem>
  );
}
