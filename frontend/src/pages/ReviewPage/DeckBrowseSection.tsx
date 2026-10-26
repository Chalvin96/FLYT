import { Button, Card, Heading, Skeleton, Text } from '@flyt/ui';
import { Check, Layers, LoaderCircle, Plus } from 'lucide-react';

import { formatNumber, pluralize } from '@/lib/utils';
import type { DeckSummaryItem } from '@/types/api';

export interface DeckBrowseSectionProps {
  decks: DeckSummaryItem[];
  isLoading?: boolean;
  subscribingDeckId?: number | null;
  onSubscribe?: (deckId: number) => void;
}

function getProgressPercent(studied: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((studied / total) * 100)));
}

function DeckSkeletonCard() {
  return (
    <Card padding="compact">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton length="short" />
          <Skeleton length="medium" size="sm" />
        </div>
        <div className="h-8 w-24">
          <Skeleton shape="pill" variant="block" />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="w-16">
          <Skeleton size="sm" />
        </div>
        <div className="w-20">
          <Skeleton size="sm" />
        </div>
      </div>
      <div className="mt-2 h-1.5">
        <Skeleton shape="pill" variant="block" />
      </div>
    </Card>
  );
}

function SubscribedBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 bg-neutral-pressed text-default">
      <Check className="icon-sm" aria-hidden />
      <Text as="span" size="small" weight="semibold">
        Subscribed
      </Text>
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
    <Card padding="compact">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Heading as="h3" size="small" tone="default">
            {deck.name}
          </Heading>
          {deck.description ? (
            <div className="mt-1">
              <Text as="p" size="medium" tone="subtle">
                {deck.description}
              </Text>
            </div>
          ) : null}
        </div>
        {deck.is_subscribed ? (
          <SubscribedBadge />
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            shape="pill"
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
        <Text as="span" size="medium" tone="subtle">
          {pluralize(deck.card_count, 'word')}
        </Text>
        {hasProgress ? (
          <Text as="span" size="medium" weight="semibold" tone="subtle">
            {formatNumber(deck.studied_count)} / {formatNumber(deck.card_count)}{' '}
            studied
          </Text>
        ) : null}
      </div>

      {hasProgress ? (
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-subtle"
          role="progressbar"
          aria-label={`${deck.name} progress`}
          aria-valuemin={0}
          aria-valuemax={deck.card_count}
          aria-valuenow={deck.studied_count}
        >
          <div
            className="h-full w-full rounded-full border border-[var(--progress-border)] bg-progress-primary-complete transition-[clip-path] duration-500 ease-out"
            style={{
              clipPath: `inset(0 calc(100% - ${progressPercent}%) 0 0 round 9999px)`,
            }}
          />
        </div>
      ) : null}
    </Card>
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
      className="mx-auto mt-12 w-full max-w-md border-t border-default/60 pt-8 pb-6"
      aria-label="Word packs"
    >
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-brand-subtle text-icon-brand">
          <Layers className="icon-sm" aria-hidden />
        </span>
        <div>
          <Heading as="div" size="xxsmall" tone="subtle">
            Expand your vocabulary
          </Heading>
          <Heading as="h2" size="medium" tone="default">
            Word packs
          </Heading>
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
