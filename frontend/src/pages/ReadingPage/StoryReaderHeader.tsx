import { Button, Skeleton, Text } from '@flyt/ui';
import { ArrowLeft, Sparkles } from 'lucide-react';
import type { RefObject } from 'react';
import { Link } from '@tanstack/react-router';

export function StoryReaderHeader({
  title,
  page,
  totalPages,
  finished = false,
  loading = false,
  chatbotOpen,
  chatbotPanelId,
  chatbotTriggerRef,
  onAskFlyt,
}: {
  title?: string;
  page?: number;
  totalPages?: number;
  finished?: boolean;
  loading?: boolean;
  chatbotOpen: boolean;
  chatbotPanelId: string;
  chatbotTriggerRef: RefObject<HTMLButtonElement | null>;
  onAskFlyt: () => void;
}) {
  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center gap-3 border-b border-default bg-overlay px-2 sm:px-4">
      <Button asChild variant="ghost" size="icon">
        <Link to="/reading" aria-label="Back to Reading">
          <ArrowLeft aria-hidden />
        </Link>
      </Button>
      <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-center">
        {loading ? (
          <div className="w-36">
            <Skeleton size="sm" />
          </div>
        ) : (
          <div className="w-full truncate" title={title}>
            <Text as="span" size="medium" weight="semibold">
              {title ?? 'Reading'}
            </Text>
          </div>
        )}
        {finished ? (
          <Text as="span" size="small" tone="subtle">
            Finished
          </Text>
        ) : page !== undefined && totalPages !== undefined ? (
          <Text as="span" size="small" tone="subtle">
            {page} / {totalPages}
          </Text>
        ) : null}
      </div>
      <Button
        aria-label="Ask Flyt"
        aria-expanded={chatbotOpen}
        aria-controls={chatbotPanelId}
        size="icon"
        variant="secondary"
        ref={chatbotTriggerRef}
        onClick={onAskFlyt}
      >
        <Sparkles aria-hidden />
      </Button>
    </header>
  );
}
