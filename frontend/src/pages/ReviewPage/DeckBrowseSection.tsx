import { Check, Layers, LoaderCircle, Plus } from 'lucide-react';

import { appCardClassName } from '@/components/common/AppCard/AppCard';
import { Button } from '@/components/common/Button/Button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatNumber, pluralize } from '@/lib/utils';
import type { DeckSummaryItem } from '@/types/api';

export interface DeckBrowseSectionProps {
  decks: DeckSummaryItem[];
  isLoading?: boolean;
  /** Deck id with a subscribe mutation currently in-flight, or null. */
  subscribingDeckId?: number | null;
  onSubscribe?: (deckId: number) => void;
}

function getProgressPercent(studied: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((studied / total) * 100)));
}

function DeckSkeletonCard() {
  return (
    <div className={cn(appCardClassName, 'p-4')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
    </div>
  );
}

function SubscribedBadge() {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 type-caption-sm font-semibold',
        'bg-secondary-20 text-secondary-90',
      )}
    >
      <Check className="icon-sm" aria-hidden />
      Subscribed
    </span>
  );
}

function DeckCard({
  deck,
  isSubscribing,
  onSubscribe,
}: {
  deck: DeckSummaryItem;
  isSubscribing: boolean;
  onSubscribe?: (deckId: number) => void;
}) {
  const progressPercent = getProgressPercent(
    deck.studied_count,
    deck.card_count,
  );
  const hasProgress = deck.studied_count > 0;

  return (
    <div className={cn(appCardClassName, 'p-4 transition-colors')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="type-body font-semibold text-foreground">
            {deck.name}
          </h3>
          {deck.description ? (
            <p className="mt-1 type-caption leading-5 text-muted-foreground">
              {deck.description}
            </p>
          ) : null}
        </div>
        {deck.is_subscribed ? (
          <SubscribedBadge />
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0 rounded-full"
            disabled={isSubscribing}
            onClick={() => onSubscribe?.(deck.id)}
          >
            {isSubscribing ? (
              <LoaderCircle className="icon-sm animate-spin" aria-hidden />
            ) : (
              <Plus className="icon-sm" aria-hidden />
            )}
            Subscribe
          </Button>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="type-caption text-muted-foreground">
          {pluralize(deck.card_count, 'word')}
        </span>
        {hasProgress ? (
          <span className="type-caption font-medium text-muted-foreground">
            {formatNumber(deck.studied_count)} / {formatNumber(deck.card_count)}{' '}
            studied
          </span>
        ) : null}
      </div>

      {hasProgress ? (
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary-10"
          role="progressbar"
          aria-label={`${deck.name} progress`}
          aria-valuemin={0}
          aria-valuemax={deck.card_count}
          aria-valuenow={deck.studied_count}
        >
          <div
            className="h-full origin-left rounded-full bg-gradient-to-r from-primary-70 to-primary-40 transition-transform duration-500 ease-out"
            style={{ transform: `scaleX(${progressPercent / 100})` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function DeckBrowseSection({
  decks,
  isLoading = false,
  subscribingDeckId = null,
  onSubscribe,
}: DeckBrowseSectionProps) {
  const hasDecks = decks.length > 0;

  return (
    <section
      className="mx-auto mt-12 w-full max-w-md border-t border-border/60 pt-8 pb-6"
      aria-label="Word packs"
    >
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary-10 text-primary-70">
          <Layers className="icon-sm" aria-hidden />
        </span>
        <div>
          <p className="type-label text-muted-foreground">
            Expand your vocabulary
          </p>
          <h2 className="font-display type-section font-semibold text-foreground">
            Word packs
          </h2>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {isLoading
          ? Array.from({ length: 2 }, (_, index) => (
              <DeckSkeletonCard key={index} />
            ))
          : hasDecks
            ? decks.map((deck) => (
                <DeckCard
                  key={deck.id}
                  deck={deck}
                  isSubscribing={subscribingDeckId === deck.id}
                  onSubscribe={onSubscribe}
                />
              ))
            : null}
      </div>
    </section>
  );
}
