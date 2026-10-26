import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import * as readingApi from '@/api/reading';
import type {
  ReadingStoryPageResponse,
  ReadingStorySummary,
} from '@/types/api';

import {
  readingKeys,
  useAllReadingThemeStories,
  useReadingStoryPages,
} from './queries';

const theme = {
  id: 1,
  key: 'daily',
  title: 'Daily life',
  order: 1,
  storyCount: 2,
};
const page = (index: number): ReadingStoryPageResponse => ({
  uuid: 'story',
  title: 'Story',
  cefrLevel: 'A1',
  groupKey: theme.key,
  groupTitle: theme.title,
  totalPages: 3,
  readingMinutes: 1,
  lastPageIndex: 2,
  completed: true,
  page: {
    index,
    content: 'kaffe',
    tokens: [{ word: 'kaffe', start: 0, end: 5, lemmaUuid: 'coffee' }],
  },
  userStates: { coffee: 'mastered' },
});
const summary = (uuid: string): ReadingStorySummary => ({
  uuid,
  title: uuid,
  cefrLevel: 'A1',
  wordCount: 100,
  readingMinutes: 1,
  isRead: false,
  completed: false,
  createdAt: '2026-10-01T00:00:00',
});
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe('story completion queries', () => {
  it('test_story_pages_given_cached_resume_and_explicit_pages_expect_only_missing_page_requested', async () => {
    const { client, wrapper } = setup();
    client.setQueryData(readingKeys.storyPage('story'), page(0));
    client.setQueryData(readingKeys.storyPage('story', 2), page(2));
    const get = vi
      .spyOn(readingApi, 'getReadingStory')
      .mockImplementation(async (_uuid, index) => page(index ?? 0));
    const { result } = renderHook(() => useReadingStoryPages('story', 3), {
      wrapper,
    });
    await waitFor(() =>
      expect(result.current.every((query) => query.isSuccess)).toBe(true),
    );
    expect(get.mock.calls.map((call) => call[1])).toEqual([1]);
    expect(result.current.map((query) => query.data?.page.index)).toEqual([
      0, 1, 2,
    ]);
    client.clear();
  });

  it('test_story_pages_given_invalidated_cached_pages_expect_no_duplicate_fetch_on_completion', async () => {
    const { client, wrapper } = setup();
    for (const index of [0, 1, 2])
      client.setQueryData(readingKeys.storyPage('story', index), page(index));
    await client.invalidateQueries({ queryKey: readingKeys.story('story') });
    const get = vi
      .spyOn(readingApi, 'getReadingStory')
      .mockResolvedValue(page(0));
    const { result } = renderHook(() => useReadingStoryPages('story', 3), {
      wrapper,
    });
    await waitFor(() =>
      expect(result.current.every((query) => query.isSuccess)).toBe(true),
    );
    expect(get).not.toHaveBeenCalled();
    client.clear();
  });

  it('test_story_pages_given_newer_resume_response_expect_latest_cached_state_without_fetch', async () => {
    const { client, wrapper } = setup();
    client.setQueryData(
      readingKeys.storyPage('story', 0),
      { ...page(0), userStates: { coffee: 'new' } },
      { updatedAt: 1 },
    );
    client.setQueryData(readingKeys.storyPage('story'), page(0), {
      updatedAt: 2,
    });
    const get = vi
      .spyOn(readingApi, 'getReadingStory')
      .mockResolvedValue(page(0));
    const { result } = renderHook(() => useReadingStoryPages('story', 1), {
      wrapper,
    });
    expect(result.current[0].data?.userStates).toEqual({ coffee: 'mastered' });
    expect(get).not.toHaveBeenCalled();
    client.clear();
  });

  it('test_theme_list_given_multiple_cursors_expect_complete_unfiltered_authored_order', async () => {
    const { client, wrapper } = setup();
    const get = vi
      .spyOn(readingApi, 'getReadingStories')
      .mockImplementation(async (_key, options) => ({
        group: theme,
        stories: [summary(options?.cursor ? 'second' : 'first')],
        nextCursor: options?.cursor ? null : 'next-page',
        totalCount: 2,
        levelCounts: { A1: 2 },
      }));
    const { result } = renderHook(() => useAllReadingThemeStories(theme.key), {
      wrapper,
    });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(
      result.current.data?.pages
        .flatMap((item) => item.stories)
        .map((item) => item.uuid),
    ).toEqual(['first', 'second']);
    expect(get.mock.calls).toEqual([
      [
        theme.key,
        { cursor: null, limit: 20, levels: [], showReadStories: true },
      ],
      [
        theme.key,
        { cursor: 'next-page', limit: 20, levels: [], showReadStories: true },
      ],
    ]);
    client.clear();
  });

  it('test_theme_list_given_import_expect_no_theme_request', async () => {
    const { client, wrapper } = setup();
    const get = vi.spyOn(readingApi, 'getReadingStories').mockResolvedValue({
      group: theme,
      stories: [],
      nextCursor: null,
      totalCount: 0,
      levelCounts: {},
    });
    const { result } = renderHook(() => useAllReadingThemeStories(null), {
      wrapper,
    });
    expect(result.current.fetchStatus).toBe('idle');
    expect(get).not.toHaveBeenCalled();
    client.clear();
  });
});
