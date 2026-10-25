import { normalizeLookupQuery } from '@flyt/lexicon/grammar';
import {
  queryOptions,
  skipToken,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { isAxiosError } from 'axios';

import {
  browseHeadword,
  getLemmaDefinitions,
  getSuggestions,
  markLemmaKnown as markApi,
} from '@/api/lexicon';
import {
  K_LEXICON_BROWSE_QUERY_MIN_LENGTH,
  K_LEXICON_SUGGEST_QUERY_MIN_LENGTH,
} from '@/api/lexicon.constants';
import { addLemmaToDeck as addApi } from '@/api/review';
import { myCardsKeys } from '@/hooks/cards/queries';
import { readingKeys } from '@/hooks/reading/queries';
import { reviewKeys } from '@/hooks/review/queries';
import { storyGenerationKeys } from '@/hooks/storyGeneration/queries';
import { collectLatestWordStates } from '@/lib/readingWordStates';
import type {
  ReadingLemmaDefinitionsResponse,
  ReadingStoryPageResponse,
  ReadingWordState,
} from '@/types/api';

export const lexiconKeys = {
  lemma: (lemmaId: number) => ['lemma', lemmaId] as const,
  browseSuggestions: (query: string) => ['browse-suggestions', query] as const,
  browseHeadword: (query: string) => ['browse-headword', query] as const,
  myLemmas: ['my-lemmas'] as const,
  lemmaDefinitions: (lemmaUuid: string) =>
    ['reading-lemma-definitions', lemmaUuid] as const,
};

function isBrowseHeadwordRetryAllowed(failureCount: number, error: unknown) {
  if (isAxiosError(error) && error.response?.status === 404) {
    return false;
  }

  return failureCount < 3;
}

function browseHeadwordQueryOptions(query: string) {
  const normalizedQuery = normalizeLookupQuery(query);
  return {
    queryKey: lexiconKeys.browseHeadword(normalizedQuery),
    queryFn: () => browseHeadword(normalizedQuery),
    enabled: normalizedQuery.length >= K_LEXICON_BROWSE_QUERY_MIN_LENGTH,
    retry: isBrowseHeadwordRetryAllowed,
  };
}

export function useBrowseHeadword(query: string) {
  return useQuery(browseHeadwordQueryOptions(query));
}

export function useCachedBrowseHeadwords(words: readonly string[]) {
  return useQueries({
    queries: words.map((word) => ({
      ...browseHeadwordQueryOptions(word),
      enabled: false,
    })),
  });
}

export function useBrowseSuggestions(query: string) {
  const normalizedQuery = normalizeLookupQuery(query);

  return useQuery({
    queryKey: lexiconKeys.browseSuggestions(normalizedQuery),
    queryFn: () => getSuggestions(normalizedQuery),
    enabled: normalizedQuery.length >= K_LEXICON_SUGGEST_QUERY_MIN_LENGTH,
  });
}

function lemmaDefinitionsQueryOptions(lemmaUuid: string | null) {
  return queryOptions({
    queryKey: lexiconKeys.lemmaDefinitions(lemmaUuid ?? 'none'),
    queryFn: lemmaUuid ? () => getLemmaDefinitions(lemmaUuid) : skipToken,
  });
}

export function useLemmaDefinitions(lemmaUuid: string | null) {
  return useQuery(lemmaDefinitionsQueryOptions(lemmaUuid));
}

export function useCachedLemmaDefinitions(lemmaUuids: readonly string[]) {
  return useQueries({
    queries: lemmaUuids.map((uuid) => ({
      ...lemmaDefinitionsQueryOptions(uuid),
      enabled: false,
    })),
  });
}

export interface UseLemmaActionsReturn {
  addLemmaToDeck(lemmaUuid: string): Promise<unknown>;
  markLemmaKnown(lemmaUuid: string): Promise<unknown>;
  isPending: boolean;
}

export function useLemmaActions(lemmaUuid: string): UseLemmaActionsReturn {
  const queryClient = useQueryClient();

  function invalidateReadingState() {
    return Promise.all([
      queryClient.invalidateQueries({
        queryKey: lexiconKeys.lemmaDefinitions(lemmaUuid),
      }),
      queryClient.invalidateQueries({
        queryKey: readingKeys.storyPrefix,
      }),
      queryClient.invalidateQueries({
        queryKey: storyGenerationKeys.current,
      }),
    ]);
  }

  async function invalidateAddToDeckState() {
    await Promise.all([
      invalidateReadingState(),
      queryClient.invalidateQueries({ queryKey: reviewKeys.dueCards.all }),
      queryClient.invalidateQueries({ queryKey: reviewKeys.decks.all }),
      queryClient.invalidateQueries({ queryKey: myCardsKeys.all }),
    ]);
  }

  const addToDeckMutation = useMutation({
    mutationFn: addApi,
    onSuccess: invalidateAddToDeckState,
  });

  const markKnownMutation = useMutation({
    mutationFn: markApi,
    onSuccess: invalidateReadingState,
  });

  return {
    addLemmaToDeck: (uuid) => addToDeckMutation.mutateAsync(uuid),
    markLemmaKnown: (uuid) => markKnownMutation.mutateAsync(uuid),
    isPending: addToDeckMutation.isPending || markKnownMutation.isPending,
  };
}

export interface AddLemmasResult {
  added: string[];
  failed: string[];
}

export interface AddLemmasRequest {
  lemmaUuids: readonly string[];
  onProgress: (completed: number, total: number) => void;
}

export function useAddLemmasToDeck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      lemmaUuids,
      onProgress,
    }: AddLemmasRequest): Promise<AddLemmasResult> => {
      const unique = [...new Set(lemmaUuids)];
      const added: string[] = [];
      const failed: string[] = [];
      await unique.reduce(
        (queue, uuid) =>
          queue.then(async () => {
            try {
              await addApi(uuid);
              added.push(uuid);
            } catch {
              failed.push(uuid);
            }
            onProgress(added.length + failed.length, unique.length);
          }),
        Promise.resolve(),
      );
      return { added, failed };
    },
    onSuccess: async ({ added }) => {
      if (added.length === 0) return;
      const cachedPages = queryClient.getQueriesData<ReadingStoryPageResponse>({
        queryKey: readingKeys.storyPrefix,
      });
      const currentStates = collectLatestWordStates([
        ...cachedPages.flatMap(([key, data]) =>
          data
            ? [
                {
                  updatedAt: queryClient.getQueryState(key)?.dataUpdatedAt ?? 0,
                  states: Object.entries(data.userStates),
                },
              ]
            : [],
        ),
        ...queryClient
          .getQueriesData<ReadingLemmaDefinitionsResponse>({
            queryKey: ['reading-lemma-definitions'],
          })
          .flatMap(([key, data]) =>
            data?.definitions[0]
              ? [
                  {
                    updatedAt:
                      queryClient.getQueryState(key)?.dataUpdatedAt ?? 0,
                    states: [
                      [data.lemma.uuid, data.definitions[0].userState] as const,
                    ],
                  },
                ]
              : [],
          ),
      ]);
      const addedState = (uuid: string): ReadingWordState =>
        currentStates.get(uuid) === 'mastered' ? 'mastered' : 'learning';
      for (const uuid of added) {
        queryClient.setQueryData<ReadingLemmaDefinitionsResponse>(
          lexiconKeys.lemmaDefinitions(uuid),
          (data) =>
            data && {
              ...data,
              definitions: data.definitions.map((definition) => ({
                ...definition,
                userState: addedState(uuid),
              })),
            },
        );
      }
      queryClient.setQueriesData<ReadingStoryPageResponse>(
        { queryKey: readingKeys.storyPrefix },
        (data) =>
          data && {
            ...data,
            userStates: {
              ...Object.fromEntries(
                Object.entries(data.userStates).map(([uuid, state]) => [
                  uuid,
                  currentStates.get(uuid) ?? state,
                ]),
              ),
              ...Object.fromEntries(
                added.map((uuid) => [uuid, addedState(uuid)]),
              ),
            },
          },
      );
      await Promise.all([
        ...added.map((uuid) =>
          queryClient.invalidateQueries({
            queryKey: lexiconKeys.lemmaDefinitions(uuid),
            refetchType: 'none',
          }),
        ),
        queryClient.invalidateQueries({
          queryKey: readingKeys.storyPrefix,
          refetchType: 'none',
        }),
        queryClient.invalidateQueries({
          queryKey: storyGenerationKeys.current,
        }),
        queryClient.invalidateQueries({ queryKey: reviewKeys.dueCards.all }),
        queryClient.invalidateQueries({ queryKey: reviewKeys.decks.all }),
        queryClient.invalidateQueries({ queryKey: myCardsKeys.all }),
      ]);
    },
  });
}
