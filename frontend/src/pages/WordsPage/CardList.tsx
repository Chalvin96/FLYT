import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Heading,
  Row,
  Text,
} from '@flyt/ui';
import { ChevronDown } from 'lucide-react';
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

/** Mastery ladder ordered weakest first. */
const BUCKET_ORDER: MasteryBucket[] = [
  'not_started',
  'learning',
  'familiar',
  'known',
  'mastered',
];

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

function MasteryBadge({ bucket }: { bucket: MasteryBucket }) {
  const badge = BUCKET_BADGE[bucket];
  return (
    <span
      data-testid={`badge-${bucket}`}
      className={cn('shrink-0 rounded-full px-2.5 py-1', badge.className)}
    >
      <span className="inline-flex items-center gap-1.5">
        <Text as="span" size="medium" weight="semibold">
          {badge.label}
        </Text>
        <MasteryRank bucket={bucket} />
      </span>
    </span>
  );
}

export function GrammarGroupRow({
  title,
  cards,
  value,
}: {
  title: string;
  cards: MyCardItem[];
  value: string;
}) {
  const weakest = getWeakestBucket(cards);

  return (
    <AccordionItem value={value}>
      <AccordionTrigger asChild>
        <Row
          insetFocusRing
          trailing={
            <>
              <MasteryBadge bucket={weakest} />
              <ChevronDown className="icon-sm text-subtle transition-transform group-data-[state=open]:rotate-180" />
            </>
          }
        >
          <div className="flex items-center gap-2">
            <Heading as="h3" size="small" tone="default">
              {title}
            </Heading>
            <Heading as="span" size="xxsmall" tone="subtle">
              Grammar
            </Heading>
          </div>
          <div className="mt-1">
            <Text as="p" size="medium" tone="subtle">
              {pluralize(cards.length, 'card')}
            </Text>
          </div>
        </Row>
      </AccordionTrigger>
      <AccordionContent>
        <div className="divide-y divide-[var(--border-default)] border-t border-default bg-neutral-subtle/40 pl-3">
          {cards.map((card) => (
            <CardRow
              key={`card-${card.user_card_id}`}
              card={card}
              onClick={() => {}}
            />
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function CardRow({
  card,
  onClick,
}: {
  card: MyCardItem;
  onClick: () => void;
}) {
  const isGrammar = card.facet === 'grammar' && card.lesson_id != null;
  const content = (
    <>
      <div className="flex items-center gap-2">
        <Heading as="h3" size="small" tone="default">
          {card.label}
        </Heading>
        <Heading as="span" size="xxsmall" tone="subtle">
          {card.facet === 'vocab' ? 'Vocab' : 'Grammar'}
        </Heading>
      </div>
      {card.subtitle && (
        <div className="mt-1 line-clamp-1">
          <Text as="p" size="medium" tone="subtle">
            {card.subtitle}
          </Text>
        </div>
      )}
    </>
  );

  if (isGrammar) {
    return (
      <Row
        asChild
        insetFocusRing
        trailing={<MasteryBadge bucket={card.bucket} />}
      >
        <Link
          to="/lesson/$lessonId"
          params={{ lessonId: String(card.lesson_id) }}
        >
          {content}
        </Link>
      </Row>
    );
  }

  return (
    <Row
      insetFocusRing
      onClick={onClick}
      trailing={<MasteryBadge bucket={card.bucket} />}
    >
      {content}
    </Row>
  );
}
