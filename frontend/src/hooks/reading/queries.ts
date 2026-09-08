import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  getReadingHome,
  getReadingStories,
  getReadingStory,
  getReadingStoryRecommendations,
  saveReadingProgress,
} from '@/api/reading';
import { getApiErrorCode } from '@/lib/apiError';
import { showApiError } from '@/lib/errors';
import { IMPORT_ERROR_CODES } from '@/types/api';

export const readingKeys = {
  home: ['reading-home'] as const,
  hero: ['reading-hero'] as const,
  stories: (groupKey: string) => ['reading-stories', groupKey] as const,
  storiesPrefix: ['reading-stories'] as const,
  storiesInfinite: (
    groupKey: string,
    filters: { selectedLevels: readonly string[]; showReadStories: boolean },
  ) => ['reading-stories-infinite', groupKey, filters] as const,
  storiesInfiniteAll: (groupKey: string) =>
    ['reading-stories-infinite', groupKey] as const,
  storiesInfinitePrefix: ['reading-stories-infinite'] as const,
  storyPrefix: ['reading-story'] as const,
  story: (uuid: string) => ['reading-story', uuid] as const,
  storyPage: (uuid: string, page?: number) =>
    ['reading-story', uuid, page ?? 'resume'] as const,
  storyRecommendations: (uuid: string) =>
    ['reading-story-recommendations', uuid] as const,
};

export function useReadingHome() {
  return useQuery({
    queryKey: readingKeys.home,
    queryFn: getReadingHome,
  });
}

/** Refetch cadence used while a reader URL is in the not-ready (409) state. */
export const NOT_READY_POLL_INTERVAL_MS = 3000;

export function useReadingStory(
  uuid: string,
  page?: number,
  options: { pollWhileNotReady?: boolean } = {},
) {
  const { pollWhileNotReady = true } = options;
  return useQuery({
    queryKey: readingKeys.storyPage(uuid, page),
    queryFn: () => getReadingStory(uuid, page),
    enabled: Boolean(uuid),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => {
      if (!pollWhileNotReady) return false;
      const error = query.state.error;
      if (
        error !== null &&
        getApiErrorCode(error) === IMPORT_ERROR_CODES.NOT_READY
      ) {
        return NOT_READY_POLL_INTERVAL_MS;
      }
      return false;
    },
  });
}

export function useReadingStoryRecommendations(uuid: string) {
  return useQuery({
    queryKey: readingKeys.storyRecommendations(uuid),
    queryFn: () => getReadingStoryRecommendations(uuid),
    enabled: Boolean(uuid),
  });
}

interface UseInfiniteReadingStoriesFilters {
  selectedLevels: string[];
  showReadStories: boolean;
}

export function useInfiniteReadingStories(
  groupKey: string,
  filters: UseInfiniteReadingStoriesFilters,
) {
  return useInfiniteQuery({
    queryKey: readingKeys.storiesInfinite(groupKey, filters),
    queryFn: ({ pageParam }) =>
      getReadingStories(groupKey, {
        cursor: pageParam,
        limit: 20,
        levels: filters.selectedLevels,
        showReadStories: filters.showReadStories,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: Boolean(groupKey),
  });
}

export function useSaveReadingProgress(uuid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pageIndex: number) => saveReadingProgress(uuid, pageIndex),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: readingKeys.story(uuid),
        }),
        queryClient.invalidateQueries({
          queryKey: readingKeys.home,
        }),
        queryClient.invalidateQueries({
          queryKey: readingKeys.hero,
        }),
        queryClient.invalidateQueries({
          queryKey: readingKeys.storiesPrefix,
        }),
        queryClient.invalidateQueries({
          queryKey: readingKeys.storiesInfinitePrefix,
        }),
      ]);
    },
    onError: (error) => {
      showApiError(error);
    },
  });
}
