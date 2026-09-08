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
        'inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border border-border bg-secondary-5 py-0.5 pl-2',
        onRemove ? 'pr-0.5' : 'pr-2.5',
      )}
      data-context-kind={context.kind}
      data-testid="chatbot-context"
      title={`${contextKindLabel[context.kind]} · ${context.label}${context.detail ? ` · ${context.detail}` : ''}`}
    >
      <ContextIcon kind={context.kind} />
      <p className="min-w-0 truncate type-caption-sm font-medium text-foreground">
        <span className="sr-only">{contextKindLabel[context.kind]}: </span>
        {context.label}
        {context.detail ? (
          <span className="sr-only"> · {context.detail}</span>
        ) : null}
      </p>
      {onRemove ? (
        <button
          aria-label="Remove context"
          className="relative flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-secondary-80 transition-colors hover:bg-secondary-20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring after:absolute after:-inset-2 after:content-['']"
          onClick={() => onRemove(context)}
          type="button"
        >
          <X className="icon-xs" aria-hidden="true" />
        </button>
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
      className="icon-xs shrink-0 text-primary-70"
      strokeWidth={1.8}
    />
  );
}
