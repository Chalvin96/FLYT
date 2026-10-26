import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import * as lexiconApi from '@/api/lexicon';
import { lexiconKeys } from '@/hooks/lexicon/queries';
import type { ReadingLemmaDefinitionsResponse } from '@/types/api';

import type { StoryLookupWord } from './storyCompletion';
import { useStoryLookups } from './useStoryLookups';

const tap: StoryLookupWord = {
  key: 'coffee:0',
  text: 'kaffen',
  lemmaUuid: 'coffee',
  state: 'new',
  sentence: 'Kaffen er varm.',
  dictionaryForm: 'kaffen',
  observedAt: 10,
};

const definitions: ReadingLemmaDefinitionsResponse = {
  lemma: {
    uuid: 'coffee',
    word: 'kaffe',
    pos: 'noun',
    primary_translation: 'coffee',
  },
  definitions: [],
};

function setup() {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe('useStoryLookups', () => {
  it('test_lookup_history_given_absent_definition_state_expect_original_page_observation_time', () => {
    const { client, wrapper } = setup();
    client.setQueryData(lexiconKeys.lemmaDefinitions('coffee'), definitions, {
      updatedAt: 30,
    });
    const { result } = renderHook(() => useStoryLookups([tap]), { wrapper });
    expect(result.current).toEqual([{ ...tap, dictionaryForm: 'kaffe' }]);
    client.clear();
  });

  it('test_lookup_history_given_new_dictionary_state_expect_cached_response_observed_without_extra_fetch', async () => {
    const { client, wrapper } = setup();
    const get = vi.spyOn(lexiconApi, 'getLemmaDefinitions');
    const { result } = renderHook(() => useStoryLookups([tap]), { wrapper });
    expect(result.current).toEqual([tap]);
    await act(async () => {
      client.setQueryData(
        lexiconKeys.lemmaDefinitions('coffee'),
        {
          ...definitions,
          definitions: [
            {
              uuid: 'definition',
              definition: 'coffee',
              translation: 'coffee',
              translation_source: 'test',
              examples: [],
              userState: 'mastered',
            },
          ],
        },
        { updatedAt: 30 },
      );
    });
    await waitFor(() =>
      expect(result.current).toEqual([
        {
          ...tap,
          dictionaryForm: 'kaffe',
          state: 'mastered',
          observedAt: 30,
        },
      ]),
    );
    expect(get).not.toHaveBeenCalled();
    client.clear();
  });
});
