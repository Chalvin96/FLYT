import type { MyCardsParams, MyCardsResponse } from '@/types/api';

import { client } from './client';

export async function getMyCards(
  params: MyCardsParams = {},
): Promise<MyCardsResponse> {
  return (
    await client.get<MyCardsResponse>('/me/cards', {
      params: {
        facet: params.facet,
        bucket: params.bucket,
        started_only: params.started_only,
        q: params.q,
        sort: params.sort,
        page: params.page,
        limit: params.limit,
      },
    })
  ).data;
}
