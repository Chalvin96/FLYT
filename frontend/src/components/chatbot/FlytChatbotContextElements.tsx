import { Button, Text } from '@flyt/ui';
import { BookMarked, BookOpenText, Quote, Sparkles, X } from 'lucide-react';

import { Marker, MarkerContent } from '@/components/chatbot/ui/marker';
import { cn } from '@/lib/utils';

import { contextKindLabel } from './chatbotContext';
import type {
  FlytChatbotContext,
  FlytChatbotContextKind,
  FlytChatbotMessage,
} from './types';

export function ContextNote({ message }: { message: FlytChatbotMessage }) {
  return (
    <Marker
      className="mt-6"
      data-message-role="note"
      data-testid="chatbot-context-note"
    >
      <MarkerContent>{message.content}</MarkerContent>
    </Marker>
  );
}

export function ContextPill({
  context,
  onRemove,
}: {
  context: FlytChatbotContext;
  onRemove?: (context: FlytChatbotContext) => void;
}) {
  return (
    <div
      className={cn(
        'inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border border-default bg-neutral py-0.5 pl-2',
        onRemove ? 'pr-0.5' : 'pr-2.5',
      )}
      data-context-kind={context.kind}
      data-testid="chatbot-context"
      title={`${contextKindLabel[context.kind]} · ${context.label}${context.detail ? ` · ${context.detail}` : ''}`}
    >
      <ContextIcon kind={context.kind} />
      <div className="min-w-0 truncate">
        <Text as="p" size="small" weight="semibold" tone="default">
          <span className="sr-only">{contextKindLabel[context.kind]}: </span>
          {context.label}
          {context.detail ? (
            <span className="sr-only"> · {context.detail}</span>
          ) : null}
        </Text>
      </div>
      {onRemove ? (
        <Button
          aria-label="Remove context"
          onClick={() => onRemove(context)}
          shape="pill"
          size="icon-sm"
          variant="ghost"
        >
          <X aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

function ContextIcon({ kind }: { kind: FlytChatbotContextKind }) {
  const Icon =
    kind === 'lesson'
      ? BookOpenText
      : kind === 'reading'
        ? BookMarked
        : kind === 'selection'
          ? Quote
          : Sparkles;

  return (
    <Icon
      aria-hidden="true"
      className="icon-xs shrink-0 text-icon-brand"
      strokeWidth={1.8}
    />
  );
}
