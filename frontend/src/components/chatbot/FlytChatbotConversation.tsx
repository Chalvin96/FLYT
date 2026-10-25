import { Heading, Text } from '@flyt/ui';
import { Bot, User } from 'lucide-react';

import { Bubble, BubbleContent } from '@/components/chatbot/ui/bubble';
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
} from '@/components/chatbot/ui/message';
import { cn } from '@/lib/utils';

import { modelLabel } from './chatbotModels';
import { PromptActions } from './FlytChatbotEmptyState';
import { ChatbotMessageMarkdown } from './FlytChatbotMarkdown';
import type { FlytChatbotMessage } from './types';

export function FollowUpActions({
  prompts,
  onPromptSelect,
}: {
  prompts: readonly string[];
  onPromptSelect: (prompt: string) => void;
}) {
  if (prompts.length === 0) return null;

  return (
    <section aria-label="Keep going" className="mt-6">
      <Heading as="h3" size="xxsmall" tone="subtle">
        Keep going
      </Heading>
      <div className="mt-3">
        <PromptActions onPromptSelect={onPromptSelect} prompts={prompts} />
      </div>
    </section>
  );
}

export function MessageRow({
  chatbotLabel,
  message,
}: {
  chatbotLabel: string;
  message: FlytChatbotMessage;
}) {
  const isUser = message.role === 'user';
  const messageChatbotLabel = message.model
    ? modelLabel[message.model]
    : chatbotLabel;

  return (
    <Message
      className="grid grid-cols-[auto_1fr] gap-x-2"
      data-message-role={message.role}
    >
      <MessageAvatar
        aria-hidden="true"
        className={cn(
          'mt-0.5 size-5 min-w-5',
          isUser
            ? 'bg-neutral-subtle text-subtle'
            : 'bg-brand-subtle text-selected',
        )}
      >
        {isUser ? (
          <User className="icon-xs" strokeWidth={2} />
        ) : (
          <Bot className="icon-xs" strokeWidth={2} />
        )}
      </MessageAvatar>
      <MessageContent className="gap-0">
        <MessageHeader className="px-0">
          <Heading as="div" size="xxsmall" tone="subtle">
            {isUser ? 'You' : messageChatbotLabel}
          </Heading>
        </MessageHeader>
        <Bubble className="max-w-full">
          <ChatbotMessageBody message={message} />
        </Bubble>
      </MessageContent>
    </Message>
  );
}

function ChatbotMessageBody({ message }: { message: FlytChatbotMessage }) {
  if (typeof message.content !== 'string') {
    return (
      <BubbleContent className="mt-1">
        <Text as="div" size="large" tone="default">
          {message.content}
        </Text>
      </BubbleContent>
    );
  }

  if (message.role === 'user') {
    return (
      <BubbleContent className="mt-1 whitespace-pre-wrap break-words">
        <Text as="div" size="large" tone="default">
          {message.content}
        </Text>
      </BubbleContent>
    );
  }

  return <ChatbotMessageMarkdown>{message.content}</ChatbotMessageMarkdown>;
}
