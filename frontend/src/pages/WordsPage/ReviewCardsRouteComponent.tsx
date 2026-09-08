import { useState } from 'react';

import { mergeMyCardsPages, useMyCards } from '@/hooks/cards/queries';
import type { CardFacet, CardSort } from '@/types/api';

import { WordsPage } from './WordsPage';

export function ReviewCardsRouteComponent() {
  const [facet, setFacet] = useState<CardFacet>('all');
  const [sort, setSort] = useState<CardSort>('weakest');
  const [query, setQuery] = useState('');
  const [showNotStarted, setShowNotStarted] = useState(false);
  const trimmedQuery = query.trim();
  const queryData = useMyCards({
    facet,
    bucket: showNotStarted ? 'not_started' : null,
    started_only: !showNotStarted,
    q: trimmedQuery,
    sort,
  });

  return (
    <WordsPage
      data={mergeMyCardsPages(queryData.data?.pages)}
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
