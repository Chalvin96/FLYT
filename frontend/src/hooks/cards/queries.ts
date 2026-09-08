import { useInfiniteQuery } from '@tanstack/react-query';

import { getMyCards } from '@/api/cards';
import type {
  CardFacet,
  CardSort,
  MasteryBucket,
  MyCardsResponse,
} from '@/types/api';

const K_DEFAULT_LIMIT = 50;

export const myCardsKeys = {
  all: ['my-cards'] as const,
  list: (params: {
    facet: CardFacet;
    bucket: MasteryBucket | null;
    started_only: boolean;
    q: string;
    sort: CardSort;
  }) =>
    [
      'my-cards',
      params.facet,
      params.bucket,
      params.started_only,
      params.q,
      params.sort,
    ] as const,
};

export function useMyCards(params: {
  facet: CardFacet;
  bucket: MasteryBucket | null;
  started_only: boolean;
  q: string;
  sort: CardSort;
}) {
  const { facet, bucket, started_only, q, sort } = params;
  return useInfiniteQuery({
    queryKey: myCardsKeys.list(params),
    queryFn: ({ pageParam }) =>
      getMyCards({
        facet,
        bucket,
        started_only,
        q: q || undefined,
        sort,
        page: pageParam,
        limit: K_DEFAULT_LIMIT,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.page + 1 : undefined,
    placeholderData: (prev) => prev,
  });
}

export function mergeMyCardsPages(
  pages: MyCardsResponse[] | undefined,
): MyCardsResponse | undefined {
  const firstPage = pages?.[0];
  if (!firstPage) return undefined;
  const lastPage = pages[pages.length - 1] ?? firstPage;
  return {
    ...firstPage,
    cards: pages.flatMap((page) => page.cards),
    page: lastPage.page,
    has_more: lastPage.has_more,
  };
}
