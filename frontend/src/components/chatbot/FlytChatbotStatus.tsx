import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';

import { warmMarkdown } from '@/lib/markdown';
import { cn } from '@/lib/utils';

export function ChatbotLiveStatus({
  chatbotLabel,
  error,
  fallbackNotice,
  hasCompletedAnswer,
  isLoading,
  lastMessageId,
}: {
  chatbotLabel: string;
  error: string | null;
  fallbackNotice: string | null;
  hasCompletedAnswer: boolean;
  isLoading: boolean;
  lastMessageId: string | null;
}) {
  return (
    <div
      aria-live="polite"
      className="sr-only"
      data-testid="chatbot-live-status"
    >
      {isLoading ? <p>Thinking…</p> : null}
      {hasCompletedAnswer && lastMessageId !== null ? (
        <p key={lastMessageId}>{chatbotLabel} replied</p>
      ) : null}
      {error ? <p>{error}</p> : null}
      {fallbackNotice ? <p>{fallbackNotice}</p> : null}
    </div>
  );
}

export function LoadingStatus({ className }: { className?: string }) {
  useEffect(() => {
    warmMarkdown();
  }, []);

  return (
    <div
      aria-busy="true"
      className={cn(
        'flex items-center gap-2 type-caption-sm text-muted-foreground',
        className,
      )}
    >
      <Loader2 className="icon-sm animate-spin" aria-hidden="true" />
      Thinking…
    </div>
  );
}
