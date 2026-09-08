import type {
  BrowseHeadwordEntryResponse,
  BrowseSuggestionsResponse,
  EmptyResponse,
  ReadingLemmaDefinitionsResponse,
  UserLemmasResponse,
} from '@/types/api';

import { client } from './client';
import { K_LEXICON_API_PATH, K_LEXICON_QUERY_PARAM } from './lexicon.constants';

export async function getMyLemmas(): Promise<UserLemmasResponse> {
  return (await client.get<UserLemmasResponse>(K_LEXICON_API_PATH.MY_LEMMAS))
    .data;
}

export async function getSuggestions(
  query: string,
): Promise<BrowseSuggestionsResponse> {
  return (
    await client.get<BrowseSuggestionsResponse>(
      K_LEXICON_API_PATH.SUGGESTIONS,
      {
        params: {
          [K_LEXICON_QUERY_PARAM.SEARCH_QUERY]: query,
        },
      },
    )
  ).data;
}

export async function browseHeadword(
  query: string,
): Promise<BrowseHeadwordEntryResponse> {
  return (
    await client.get<BrowseHeadwordEntryResponse>(K_LEXICON_API_PATH.BROWSE, {
      params: { [K_LEXICON_QUERY_PARAM.BROWSE_QUERY]: query },
    })
  ).data;
}

export async function getLemmaDefinitions(
  lemmaUuid: string,
): Promise<ReadingLemmaDefinitionsResponse> {
  return (
    await client.get<ReadingLemmaDefinitionsResponse>(
      `${K_LEXICON_API_PATH.LEMMAS}/${lemmaUuid}/definitions`,
    )
  ).data;
}

export async function markLemmaKnown(
  lemmaUuid: string,
): Promise<EmptyResponse> {
  return (
    await client.post<EmptyResponse>(
      `${K_LEXICON_API_PATH.LEMMAS}/${lemmaUuid}/mark-known`,
    )
  ).data;
}
