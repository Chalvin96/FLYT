import {
  Button,
  Card,
  Chip,
  Heading,
  Skeleton,
  Text,
  textVariants,
} from '@flyt/ui';
import { BookOpen, Search } from 'lucide-react';
import { Link } from '@tanstack/react-router';

import { ErrorMessage } from '@/components/common/ErrorMessage/ErrorMessage';
import { useLookupContext } from '@/components/lookup/useLookupContext';
import { cn, pluralize } from '@/lib/utils';
import type {
  CardFacet,
  CardSort,
  MyCardItem,
  MyCardsResponse,
} from '@/types/api';

import { BUCKETS } from './CardListModel';
import { CardListSection } from './CardListSection';
import { MasteryRank } from './MasteryRank';

const FACET_TABS: { key: CardFacet; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'vocab', label: 'Vocab' },
  { key: 'grammar', label: 'Grammar' },
];

const SORT_OPTIONS: { key: CardSort; label: string }[] = [
  { key: 'weakest', label: 'Weakest first' },
  { key: 'recent', label: 'Recently reviewed' },
  { key: 'alpha', label: 'A to Z' },
];

export interface WordsPagePagination {
  hasMore: boolean;
  isLoading: boolean;
  hasError: boolean;
  onLoadMore: () => void;
}

export interface WordsPageProps {
  data?: MyCardsResponse;
  isPending: boolean;
  isError: boolean;
  facet: CardFacet;
  onFacetChange: (facet: CardFacet) => void;
  sort: CardSort;
  onSortChange: (sort: CardSort) => void;
  query: string;
  onQueryChange: (query: string) => void;
  showNotStarted: boolean;
  onShowNotStartedChange: (show: boolean) => void;
  pagination?: WordsPagePagination;
}

export function WordsPage(props: WordsPageProps) {
  const { data, isPending, isError } = props;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-6">
      <Heading as="h1" size="large" tone="default">
        My cards
      </Heading>

      <WordsPageBody
        isError={isError}
        isPending={isPending}
        summary={data?.summary}
      >
        <WordsActiveSection {...props} />
      </WordsPageBody>
    </div>
  );
}

function WordsPageBody({
  children,
  isError,
  isPending,
  summary,
}: {
  children: React.ReactNode;
  isError: boolean;
  isPending: boolean;
  summary: MyCardsResponse['summary'] | undefined;
}) {
  if (isPending) {
    return <LoadingState />;
  }

  if (isError) {
    return (
      <Card padding="roomy">
        <Text size="large" tone="subtle">
          Could not load your cards. Please refresh and try again.
        </Text>
      </Card>
    );
  }

  if ((summary?.total ?? 0) === 0) {
    return <EmptyState />;
  }

  return <>{children}</>;
}

function WordsActiveSection({
  data,
  facet,
  onFacetChange,
  sort,
  onSortChange,
  query,
  onQueryChange,
  showNotStarted,
  onShowNotStartedChange,
  pagination,
}: WordsPageProps) {
  const { openLemma } = useLookupContext();
  const cards = data?.cards ?? [];
  const summary = data?.summary;
  const notStartedCount = summary?.counts_by_bucket.not_started ?? 0;
  const trimmedQuery = query.trim();
  const facetLabel =
    FACET_TABS.find((tab) => tab.key === facet)?.label ?? 'All';
  const sortLabel =
    SORT_OPTIONS.find((option) => option.key === sort)?.label ??
    'Weakest first';

  const handleCardClick = (card: MyCardItem) => {
    if (card.facet === 'vocab' && card.lemma_uuid) {
      openLemma(card.lemma_uuid, card.label);
    }
  };

  return (
    <>
      <SummaryStrip summary={summary} />

      <div className="flex flex-wrap items-center gap-2">
        {FACET_TABS.map((tab) => (
          <FacetTabButton
            isActive={facet === tab.key}
            key={tab.key}
            label={tab.label}
            onClick={() => onFacetChange(tab.key)}
          />
        ))}
      </div>

      <SearchControls
        onQueryChange={onQueryChange}
        onSortChange={onSortChange}
        query={query}
        sort={sort}
      />

      {!showNotStarted && notStartedCount > 0 ? (
        <div className="self-start">
          <Chip onClick={() => onShowNotStartedChange(true)}>
            {`Show ${pluralize(notStartedCount, 'not-started card')}`}
          </Chip>
        </div>
      ) : null}

      {cards.length === 0 ? (
        <FilteredEmptyState
          facet={facet}
          onQueryChange={onQueryChange}
          onShowNotStartedChange={onShowNotStartedChange}
          showNotStarted={showNotStarted}
          trimmedQuery={trimmedQuery}
        />
      ) : (
        <>
          <ActiveStateSummary
            facetLabel={facetLabel}
            onQueryChange={onQueryChange}
            sortLabel={sortLabel}
            trimmedQuery={trimmedQuery}
          />
          <CardListSection cards={cards} onCardClick={handleCardClick} />
          {pagination && (pagination.hasMore || pagination.hasError) ? (
            <PaginationControls pagination={pagination} />
          ) : null}
        </>
      )}

      {showNotStarted ? (
        <span className="inline-flex self-start">
          <Button onClick={() => onShowNotStartedChange(false)} variant="link">
            ← Back to started cards
          </Button>
        </span>
      ) : null}
    </>
  );
}

function PaginationControls({
  pagination,
}: {
  pagination: WordsPagePagination;
}) {
  if (pagination.hasError) {
    return (
      <ErrorMessage
        error="Please try again to continue."
        onRetry={pagination.onLoadMore}
        retryLabel="Try again"
        title="Could not load more cards"
      />
    );
  }

  return (
    <span className="inline-flex self-start">
      <Button
        disabled={pagination.isLoading}
        onClick={pagination.onLoadMore}
        variant="outline"
      >
        {pagination.isLoading ? 'Loading more cards…' : 'Load more cards'}
      </Button>
    </span>
  );
}

function LoadingState() {
  return (
    <Card padding="none">
      <div className="divide-y divide-[var(--border-default)]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div className="px-5 py-4" key={i}>
            <Skeleton length="medium" size="sm" variant="heading" />
            <div className="mt-2">
              <Skeleton length="short" size="sm" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card padding="roomy">
      <div className="flex flex-col items-center gap-3 text-center">
        <BookOpen className="icon-xl text-subtle" />
        <Heading as="h2" size="medium" tone="default">
          No cards yet
        </Heading>
        <div className="max-w-sm">
          <Text as="p" size="large" tone="subtle">
            Complete a lesson or add words from the dictionary to start building
            your review deck. Cards you study will collect here with a mastery
            level.
          </Text>
        </div>
        <Button asChild>
          <Link to="/lesson">Browse lessons</Link>
        </Button>
      </div>
    </Card>
  );
}

function ActiveStateSummary({
  facetLabel,
  onQueryChange,
  sortLabel,
  trimmedQuery,
}: {
  facetLabel: string;
  onQueryChange: (value: string) => void;
  sortLabel: string;
  trimmedQuery: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Text data-testid="cards-summary" size="medium" tone="subtle">
        {`${facetLabel} · ${sortLabel}`}
      </Text>
      {trimmedQuery ? (
        <Chip
          aria-label={`Clear search "${trimmedQuery}"`}
          onClick={() => onQueryChange('')}
          removable
        >
          {`"${trimmedQuery}"`}
        </Chip>
      ) : null}
    </div>
  );
}

function FilteredEmptyState({
  facet,
  onQueryChange,
  onShowNotStartedChange,
  showNotStarted,
  trimmedQuery,
}: {
  facet: CardFacet;
  onQueryChange: (value: string) => void;
  onShowNotStartedChange: (show: boolean) => void;
  showNotStarted: boolean;
  trimmedQuery: string;
}) {
  const heading = trimmedQuery
    ? `No cards match "${trimmedQuery}".`
    : facet !== 'all'
      ? `No ${facet} cards in this view.`
      : 'No cards in this view.';

  return (
    <Card padding="roomy">
      <div className="text-center">
        <Text size="large" tone="subtle">
          {heading}
        </Text>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
          {trimmedQuery ? (
            <Button onClick={() => onQueryChange('')} variant="link">
              Clear search
            </Button>
          ) : null}
          {showNotStarted ? (
            <Button
              onClick={() => onShowNotStartedChange(false)}
              variant="link"
            >
              Back to started cards
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function SummaryStrip({
  summary,
}: {
  summary: MyCardsResponse['summary'] | undefined;
}) {
  const counts = summary?.counts_by_bucket;
  const total = summary?.total ?? 0;

  return (
    <div data-testid="summary-strip">
      <div className="flex items-baseline justify-between">
        <Heading as="div" size="xxsmall" tone="subtle">
          {pluralize(total, 'card')} total
        </Heading>
      </div>
      {/* Tailwind preflight strips list-style, which drops list semantics in
          Safari/VoiceOver — keep the explicit role. */}
      <ul
        aria-label="Mastery breakdown"
        className="mt-2 flex gap-2 overflow-x-auto pb-0.5 scrollbar-none"
        role="list"
      >
        {BUCKETS.map((bucket) => {
          const count = counts?.[bucket.key] ?? 0;
          return (
            <li
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5',
                bucket.className,
              )}
              data-testid={`bucket-${bucket.key}`}
              key={bucket.key}
            >
              <Text as="span" size="medium" weight="semibold">
                {count}
              </Text>
              <Text as="span" size="medium">
                {bucket.label}
              </Text>
              <MasteryRank bucket={bucket.key} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FacetTabButton({
  isActive,
  label,
  onClick,
}: {
  isActive: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Chip onClick={onClick} pressed={isActive}>
      {label}
    </Chip>
  );
}

function SearchControls({
  onQueryChange,
  onSortChange,
  query,
  sort,
}: {
  onQueryChange: (value: string) => void;
  onSortChange: (value: CardSort) => void;
  query: string;
  sort: CardSort;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="icon-sm absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
        <label className="sr-only" htmlFor="my-cards-search">
          Search your cards
        </label>
        <input
          className={`h-9 w-full radius-field border border-strong bg-raised pl-9 pr-3 outline-none placeholder:text-subtle focus-visible:border-transparent focus-visible:ring-1 focus-visible:ring-[var(--border-focused)] ${textVariants({ size: 'medium' })}`}
          id="my-cards-search"
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search your cards"
          type="text"
          value={query}
        />
      </div>
      <select
        aria-label="Sort cards"
        className={`h-9 cursor-pointer radius-field border border-strong bg-transparent px-2 outline-none focus-visible:border-transparent focus-visible:ring-1 focus-visible:ring-[var(--border-focused)] ${textVariants({ size: 'medium' })}`}
        onChange={(e) => onSortChange(e.target.value as CardSort)}
        value={sort}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
