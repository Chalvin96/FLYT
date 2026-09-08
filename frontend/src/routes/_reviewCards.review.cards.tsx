import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';

import { mergeMyCardsPages, useMyCards } from '@/hooks/cards/queries';
import { WordsPage } from '@/pages/WordsPage/WordsPage';
import type { CardFacet, CardSort } from '@/types/api';

export function ReviewCardsRouteComponent() {
  const [facet, setFacet] = useState<CardFacet>('all');
  const [sort, setSort] = useState<CardSort>('weakest');
  const [query, setQuery] = useState('');
  const [showNotStarted, setShowNotStarted] = useState(false);

  const trimmedQuery = query.trim();
  const bucket = showNotStarted ? ('not_started' as const) : null;
  const queryData = useMyCards({
    facet,
    bucket,
    started_only: !showNotStarted,
    q: trimmedQuery,
    sort,
  });
  const data = mergeMyCardsPages(queryData.data?.pages);

  return (
    <WordsPage
      data={data}
      isPending={queryData.isPending}
      isError={queryData.isLoadingError}
      facet={facet}
      onFacetChange={setFacet}
      sort={sort}
      onSortChange={setSort}
      query={query}
      onQueryChange={setQuery}
      showNotStarted={showNotStarted}
      onShowNotStartedChange={setShowNotStarted}
      pagination={{
        hasMore: Boolean(queryData.hasNextPage),
        isLoading: queryData.isFetchingNextPage,
        hasError: queryData.isFetchNextPageError,
        onLoadMore: () => void queryData.fetchNextPage(),
      }}
    />
  );
}

export const Route = createFileRoute('/_reviewCards/review/cards')({
  component: ReviewCardsRouteComponent,
});
