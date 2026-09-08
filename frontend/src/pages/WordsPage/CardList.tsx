import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';

import { cn, pluralize } from '@/lib/utils';
import type { MasteryBucket, MyCardItem } from '@/types/api';

import { BUCKETS } from './CardListModel';
import { MasteryRank } from './MasteryRank';

const BUCKET_BADGE: Record<
  MasteryBucket,
  { label: string; className: string }
> = {
  not_started: BUCKETS[0],
  learning: BUCKETS[1],
  familiar: BUCKETS[2],
  known: BUCKETS[3],
  mastered: BUCKETS[4],
};

/** Ordered mastery ladder (index 0 = weakest). Used to find a group's weakest card. */
const BUCKET_ORDER: MasteryBucket[] = [
  'not_started',
  'learning',
  'familiar',
  'known',
  'mastered',
];

/** Returns the weakest bucket among the given cards (lowest index wins). */
function getWeakestBucket(cards: MyCardItem[]): MasteryBucket {
  let weakestIndex = BUCKET_ORDER.length - 1;
  for (const card of cards) {
    const idx = BUCKET_ORDER.indexOf(card.bucket);
    if (idx < weakestIndex) {
      weakestIndex = idx;
    }
  }
  return BUCKET_ORDER[weakestIndex] ?? 'not_started';
}

export function GrammarGroupRow({
  title,
  cards,
}: {
  title: string;
  cards: MyCardItem[];
}) {
  const [expanded, setExpanded] = useState(false);
  const weakest = getWeakestBucket(cards);
  const badge = BUCKET_BADGE[weakest];

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full cursor-pointer items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-secondary-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="type-body font-semibold text-foreground">{title}</h3>
            <span className="type-label text-muted-foreground">grammar</span>
          </div>
          <p className="mt-1 type-caption text-muted-foreground">
            {pluralize(cards.length, 'card')}
          </p>
        </div>
        <span
          data-testid={`badge-${weakest}`}
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 type-caption font-medium',
            badge.className,
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            {badge.label}
            <MasteryRank bucket={weakest} />
          </span>
        </span>
        <ChevronDown
          className={cn(
            'icon-sm text-muted-foreground transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>
      {expanded ? (
        <div className="divide-y divide-border border-t border-border bg-secondary-10/40 pl-3">
          {cards.map((card) => (
            <CardRow
              key={`card-${card.user_card_id}`}
              card={card}
              onClick={() => {}}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CardRow({
  card,
  onClick,
}: {
  card: MyCardItem;
  onClick: () => void;
}) {
  const badge = BUCKET_BADGE[card.bucket];
  const isGrammar = card.facet === 'grammar' && card.lesson_id != null;
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="type-body font-semibold text-foreground">
            {card.label}
          </h3>
          <span className="type-label text-muted-foreground">
            {card.facet === 'vocab' ? 'vocab' : 'grammar'}
          </span>
        </div>
        {card.subtitle && (
          <p className="mt-1 line-clamp-1 type-caption text-muted-foreground">
            {card.subtitle}
          </p>
        )}
      </div>
      <span
        data-testid={`badge-${card.bucket}`}
        className={cn(
          'shrink-0 rounded-full px-2.5 py-1 type-caption font-medium',
          badge.className,
        )}
      >
        <span className="inline-flex items-center gap-1.5">
          {badge.label}
          <MasteryRank bucket={card.bucket} />
        </span>
      </span>
    </>
  );

  if (isGrammar) {
    return (
      <Link
        to="/lesson/$lessonId"
        params={{ lessonId: String(card.lesson_id) }}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-secondary-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-secondary-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {content}
    </button>
  );
}
