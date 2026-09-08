import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import * as lexiconApi from '@/api/lexicon';
import * as reviewApi from '@/api/review';
import { myCardsKeys } from '@/hooks/cards/queries';
import { lexiconKeys, useLemmaActions } from '@/hooks/lexicon/queries';
import { readingKeys } from '@/hooks/reading/queries';
import { reviewKeys } from '@/hooks/review/queries';
import { storyGenerationKeys } from '@/hooks/storyGeneration/queries';

describe('useLemmaActions', () => {
  it.each(['addLemmaToDeck', 'markLemmaKnown'] as const)(
    'test_lemma_action_given_success_expect_only_affected_cached_queries_invalidated',
    async (action) => {
      const qc = new QueryClient();
      vi.spyOn(reviewApi, 'addLemmaToDeck').mockResolvedValue({});
      vi.spyOn(lexiconApi, 'markLemmaKnown').mockResolvedValue({});

      const readingState = [
        lexiconKeys.lemmaDefinitions('lemma-1'),
        readingKeys.storyPage('story-1'),
        readingKeys.storyPage('story-1', 2),
        readingKeys.storyPage('story-2', 1),
        storyGenerationKeys.current,
      ];
      const reviewState = [
        reviewKeys.dueCards.byMode('quick'),
        reviewKeys.dueCards.byMode('full'),
        reviewKeys.decks.all,
        myCardsKeys.list({
          facet: 'all',
          bucket: null,
          started_only: false,
          q: '',
          sort: 'weakest',
        }),
      ];
      const untouched = [
        lexiconKeys.lemmaDefinitions('other-lemma'),
        readingKeys.storyRecommendations('story-1'),
        readingKeys.home,
      ];
      const affected =
        action === 'addLemmaToDeck'
          ? [...readingState, ...reviewState]
          : readingState;
      const unaffected =
        action === 'addLemmaToDeck'
          ? untouched
          : [...untouched, ...reviewState];
      for (const key of [...affected, ...unaffected]) {
        qc.setQueryData(key, { cached: true });
      }

      const wrapper = ({ children }: { children?: React.ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      );
      const { result } = renderHook(() => useLemmaActions('lemma-1'), {
        wrapper,
      });

      await result.current[action]('lemma-1');

      for (const key of affected) {
        expect(qc.getQueryState(key)?.isInvalidated, JSON.stringify(key)).toBe(
          true,
        );
      }
      for (const key of unaffected) {
        expect(qc.getQueryState(key)?.isInvalidated, JSON.stringify(key)).toBe(
          false,
        );
      }
      qc.clear();
    },
  );

  it('test_lemma_action_given_pending_mutation_expect_pending_until_settled', async () => {
    const qc = new QueryClient();
    let resolveAddToDeck: (value: Record<string, never>) => void;
    const addPromise = new Promise<Record<string, never>>((resolve) => {
      resolveAddToDeck = resolve;
    });
    vi.spyOn(reviewApi, 'addLemmaToDeck').mockReturnValue(addPromise);

    const wrapper = ({ children }: { children?: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result, rerender } = renderHook(() => useLemmaActions('lemma-1'), {
      wrapper,
    });

    expect(result.current.isPending).toBe(false);

    const mutationPromise = result.current.addLemmaToDeck('lemma-1');

    rerender();
    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    resolveAddToDeck!({});
    await mutationPromise;

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
  });
});
