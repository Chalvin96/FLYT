import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import * as reviewApi from '@/api/review';
import { readingKeys } from '@/hooks/reading/queries';
import type {
  ReadingLemmaDefinitionsResponse,
  ReadingStoryPageResponse,
} from '@/types/api';

import { lexiconKeys, useAddLemmasToDeck } from './queries';

describe('useAddLemmasToDeck', () => {
  it('test_batch_review_given_partial_failure_expect_each_unique_lemma_progress_and_successful_cache_updates', async () => {
    const add = vi
      .spyOn(reviewApi, 'addLemmaToDeck')
      .mockImplementation(async (uuid) => {
        if (uuid === 'failed') throw new Error('Unavailable');
        return {};
      });
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const page: ReadingStoryPageResponse = {
      uuid: 'story',
      title: 'Story',
      cefrLevel: 'A1',
      groupKey: null,
      groupTitle: null,
      totalPages: 1,
      readingMinutes: 1,
      lastPageIndex: 0,
      completed: true,
      page: { index: 0, content: 'kaffe', tokens: [] },
      userStates: { first: 'new', failed: 'new', known: 'mastered' },
    };
    client.setQueryData(readingKeys.storyPage('story', 0), page);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useAddLemmasToDeck(), { wrapper });
    const progress = vi.fn();
    await expect(
      result.current.mutateAsync({
        lemmaUuids: ['first', 'failed', 'second', 'first'],
        onProgress: progress,
      }),
    ).resolves.toEqual({ added: ['first', 'second'], failed: ['failed'] });
    expect(add.mock.calls.map((call) => call[0])).toEqual([
      'first',
      'failed',
      'second',
    ]);
    expect(progress.mock.calls).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
    expect(
      client.getQueryData<ReadingStoryPageResponse>(
        readingKeys.storyPage('story', 0),
      )?.userStates,
    ).toEqual({
      first: 'learning',
      failed: 'new',
      second: 'learning',
      known: 'mastered',
    });
    client.clear();
  });

  it('test_batch_review_given_every_request_fails_expect_no_cache_state_claimed', async () => {
    vi.spyOn(reviewApi, 'addLemmaToDeck').mockRejectedValue(
      new Error('Unavailable'),
    );
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useAddLemmasToDeck(), { wrapper });
    await expect(
      result.current.mutateAsync({
        lemmaUuids: ['first'],
        onProgress: vi.fn(),
      }),
    ).resolves.toEqual({ added: [], failed: ['first'] });
    expect(invalidate).not.toHaveBeenCalled();
    client.clear();
  });

  it('test_batch_review_given_different_cache_ages_expect_latest_mastery_preserved_across_pages', async () => {
    vi.spyOn(reviewApi, 'addLemmaToDeck').mockResolvedValue({});
    const client = new QueryClient();
    const page: ReadingStoryPageResponse = {
      uuid: 'story',
      title: 'Story',
      cefrLevel: 'A1',
      groupKey: null,
      groupTitle: null,
      totalPages: 2,
      readingMinutes: 1,
      lastPageIndex: 1,
      completed: true,
      page: { index: 0, content: 'kaffe', tokens: [] },
      userStates: { changed: 'mastered', added: 'new', known: 'new' },
    };
    client.setQueryData(readingKeys.storyPage('story', 0), page, {
      updatedAt: 20,
    });
    client.setQueryData(
      readingKeys.storyPage('story', 1),
      {
        ...page,
        page: { ...page.page, index: 1 },
        userStates: { changed: 'new' },
      },
      { updatedAt: 10 },
    );
    const definition: ReadingLemmaDefinitionsResponse = {
      lemma: {
        uuid: 'known',
        word: 'ord',
        pos: 'noun',
        primary_translation: 'word',
      },
      definitions: [
        {
          uuid: 'definition',
          definition: 'Et ord',
          translation: 'word',
          translation_source: null,
          examples: [],
          userState: 'mastered',
        },
      ],
    };
    client.setQueryData(lexiconKeys.lemmaDefinitions('known'), definition, {
      updatedAt: 30,
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useAddLemmasToDeck(), { wrapper });
    await result.current.mutateAsync({
      lemmaUuids: ['added', 'known'],
      onProgress: vi.fn(),
    });
    for (const index of [0, 1]) {
      expect(
        client.getQueryData<ReadingStoryPageResponse>(
          readingKeys.storyPage('story', index),
        )?.userStates,
      ).toMatchObject({
        changed: 'mastered',
        added: 'learning',
        known: 'mastered',
      });
    }
    expect(
      client.getQueryData<ReadingLemmaDefinitionsResponse>(
        lexiconKeys.lemmaDefinitions('known'),
      )?.definitions[0].userState,
    ).toBe('mastered');
    client.clear();
  });
});
