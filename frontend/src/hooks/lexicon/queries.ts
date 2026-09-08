import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

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

export const lexiconKeys = {
  lemma: (lemmaId: number) => ['lemma', lemmaId] as const,
  browseSuggestions: (query: string) => ['browse-suggestions', query] as const,
  browseHeadword: (query: string) => ['browse-headword', query] as const,
  myLemmas: ['my-lemmas'] as const,
  lemmaDefinitions: (lemmaUuid: string) =>
    ['reading-lemma-definitions', lemmaUuid] as const,
};

export function useBrowseHeadword(query: string) {
  const normalizedQuery = query.trim();

  return useQuery({
    queryKey: lexiconKeys.browseHeadword(normalizedQuery),
    queryFn: () => browseHeadword(normalizedQuery),
    enabled: normalizedQuery.length >= K_LEXICON_BROWSE_QUERY_MIN_LENGTH,
  });
}

export function useBrowseSuggestions(query: string) {
  const normalizedQuery = query.trim();

  return useQuery({
    queryKey: lexiconKeys.browseSuggestions(normalizedQuery),
    queryFn: () => getSuggestions(normalizedQuery),
    enabled: normalizedQuery.length >= K_LEXICON_SUGGEST_QUERY_MIN_LENGTH,
  });
}

export function useLemmaDefinitions(lemmaUuid: string | null) {
  return useQuery({
    queryKey: lexiconKeys.lemmaDefinitions(lemmaUuid ?? 'none'),
    queryFn: lemmaUuid ? () => getLemmaDefinitions(lemmaUuid) : skipToken,
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
