import { BookOpen, Search } from 'lucide-react';
import { Link } from '@tanstack/react-router';

import { AppCard } from '@/components/common/AppCard/AppCard';
import { Button } from '@/components/common/Button/Button';
import { ErrorMessage } from '@/components/common/ErrorMessage/ErrorMessage';
import { useLookupContext } from '@/components/lookup/useLookupContext';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, pluralize } from '@/lib/utils';
import type {
  CardFacet,
  CardSort,
  MyCardItem,
  MyCardsResponse,
} from '@/types/api';

import { CardRow, GrammarGroupRow } from './CardList';
import { BUCKETS, buildRenderItems } from './CardListModel';
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

export function WordsPage({
  data,
  isPending,
  isError,
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
  const renderItems = buildRenderItems(cards);
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
    <div className="container-max mx-auto flex w-full max-w-2xl flex-col gap-6 pb-6">
      <h1 className="type-title text-foreground">My cards</h1>

      {isPending ? (
        <LoadingState />
      ) : isError ? (
        <AppCard className="p-6">
          <p className="type-body text-muted-foreground">
            Could not load your cards. Please refresh and try again.
          </p>
        </AppCard>
      ) : (summary?.total ?? 0) === 0 ? (
        <EmptyState />
      ) : (
        <>
          <SummaryStrip summary={summary} />

          <div className="flex flex-wrap items-center gap-2">
            {FACET_TABS.map((tab) => (
              <FacetTabButton
                key={tab.key}
                label={tab.label}
                isActive={facet === tab.key}
                onClick={() => onFacetChange(tab.key)}
              />
            ))}
          </div>

          <SearchControls
            query={query}
            onQueryChange={onQueryChange}
            sort={sort}
            onSortChange={onSortChange}
          />

          {!showNotStarted && notStartedCount > 0 ? (
            <button
              type="button"
              onClick={() => onShowNotStartedChange(true)}
              className="self-start cursor-pointer rounded-full border border-border px-3 py-1.5 type-caption font-medium text-muted-foreground transition-colors hover:bg-secondary-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {`Show ${pluralize(notStartedCount, 'not-started card')}`}
            </button>
          ) : null}

          {cards.length === 0 ? (
            <FilteredEmptyState
              trimmedQuery={trimmedQuery}
              facet={facet}
              showNotStarted={showNotStarted}
              onQueryChange={onQueryChange}
              onShowNotStartedChange={onShowNotStartedChange}
            />
          ) : (
            <>
              <ActiveStateSummary
                facetLabel={facetLabel}
                sortLabel={sortLabel}
                trimmedQuery={trimmedQuery}
                onQueryChange={onQueryChange}
              />
              <AppCard className="divide-y divide-border p-0">
                {renderItems.map((item) =>
                  item.kind === 'card' ? (
                    <CardRow
                      key={`card-${item.card.user_card_id}`}
                      card={item.card}
                      onClick={() => handleCardClick(item.card)}
                    />
                  ) : (
                    <GrammarGroupRow
                      key={`group-${item.lessonId}`}
                      title={item.title}
                      cards={item.cards}
                    />
                  ),
                )}
              </AppCard>
              {pagination && (pagination.hasMore || pagination.hasError) ? (
                <PaginationControls pagination={pagination} />
              ) : null}
            </>
          )}

          {showNotStarted ? (
            <Button
              variant="link"
              className="self-start"
              onClick={() => onShowNotStartedChange(false)}
            >
              ← Back to started cards
            </Button>
          ) : null}
        </>
      )}
    </div>
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
        title="Could not load more cards"
        error="Please try again to continue."
        onRetry={pagination.onLoadMore}
        retryLabel="Try again"
      />
    );
  }

  return (
    <Button
      variant="outline"
      className="self-start"
      onClick={pagination.onLoadMore}
      disabled={pagination.isLoading}
    >
      {pagination.isLoading ? 'Loading more cards…' : 'Load more cards'}
    </Button>
  );
}

function LoadingState() {
  return (
    <AppCard className="divide-y divide-border p-0">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="px-5 py-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-3 w-24" />
        </div>
      ))}
    </AppCard>
  );
}

function EmptyState() {
  return (
    <AppCard className="flex flex-col items-center gap-3 p-8 text-center">
      <BookOpen className="icon-xl text-muted-foreground" />
      <h2 className="type-section text-foreground">No cards yet</h2>
      <p className="max-w-sm type-body text-muted-foreground">
        Complete a lesson or add words from the dictionary to start building
        your review deck. Cards you study will collect here with a mastery
        level.
      </p>
      <Button asChild>
        <Link to="/lesson">Browse lessons</Link>
      </Button>
    </AppCard>
  );
}

interface ActiveStateSummaryProps {
  facetLabel: string;
  sortLabel: string;
  trimmedQuery: string;
  onQueryChange: (value: string) => void;
}

function ActiveStateSummary({
  facetLabel,
  sortLabel,
  trimmedQuery,
  onQueryChange,
}: ActiveStateSummaryProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p
        data-testid="cards-summary"
        className="type-caption text-muted-foreground"
      >
        {`${facetLabel} · ${sortLabel}`}
      </p>
      {trimmedQuery ? (
        <button
          type="button"
          onClick={() => onQueryChange('')}
          aria-label={`Clear search "${trimmedQuery}"`}
          className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border px-2 py-0.5 type-caption text-muted-foreground transition-colors hover:bg-secondary-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="font-medium">{`"${trimmedQuery}"`}</span>
          <span aria-hidden="true">✕</span>
        </button>
      ) : null}
    </div>
  );
}

interface FilteredEmptyStateProps {
  trimmedQuery: string;
  facet: CardFacet;
  showNotStarted: boolean;
  onQueryChange: (value: string) => void;
  onShowNotStartedChange: (show: boolean) => void;
}

function FilteredEmptyState({
  trimmedQuery,
  facet,
  showNotStarted,
  onQueryChange,
  onShowNotStartedChange,
}: FilteredEmptyStateProps) {
  // F5: name the filter that produced no results, then offer recovery actions
  // which may co-render (Clear search + Back to started cards).
  const heading = trimmedQuery
    ? `No cards match "${trimmedQuery}".`
    : facet !== 'all'
      ? `No ${facet} cards in this view.`
      : 'No cards in this view.';

  return (
    <AppCard className="p-6 text-center">
      <p className="type-body text-muted-foreground">{heading}</p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
        {trimmedQuery ? (
          <Button variant="link" onClick={() => onQueryChange('')}>
            Clear search
          </Button>
        ) : null}
        {showNotStarted ? (
          <Button variant="link" onClick={() => onShowNotStartedChange(false)}>
            Back to started cards
          </Button>
        ) : null}
      </div>
    </AppCard>
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
        <p className="type-label text-muted-foreground">
          {pluralize(total, 'card')} total
        </p>
      </div>
      {/* Tailwind preflight strips list-style, which drops list semantics in
          Safari/VoiceOver — keep the explicit role. */}
      <ul
        role="list"
        className="mt-2 flex gap-2 overflow-x-auto pb-0.5 scrollbar-none"
        aria-label="Mastery breakdown"
      >
        {BUCKETS.map((bucket) => {
          const count = counts?.[bucket.key] ?? 0;
          return (
            <li
              key={bucket.key}
              data-testid={`bucket-${bucket.key}`}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5',
                bucket.className,
              )}
            >
              <span className="type-caption font-semibold">{count}</span>
              <span className="type-caption">{bucket.label}</span>
              <MasteryRank bucket={bucket.key} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FacetTabButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={cn(
        'cursor-pointer rounded-full border px-3 py-1.5 type-caption font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive
          ? 'border-primary-60 bg-primary-10 text-primary-90'
          : 'border-border text-muted-foreground hover:bg-secondary-10',
      )}
    >
      {label}
    </button>
  );
}

function SearchControls({
  query,
  onQueryChange,
  sort,
  onSortChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  sort: CardSort;
  onSortChange: (value: CardSort) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="icon-sm absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <label htmlFor="my-cards-search" className="sr-only">
          Search your cards
        </label>
        <input
          id="my-cards-search"
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search your cards"
          className="h-9 w-full radius-field border border-input bg-card pl-9 pr-3 type-caption outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value as CardSort)}
        aria-label="Sort cards"
        className="h-9 cursor-pointer radius-field border border-input bg-transparent px-2 type-caption outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
