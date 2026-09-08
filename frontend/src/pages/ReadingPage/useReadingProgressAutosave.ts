import { useEffect, useRef } from 'react';

import {
  useReadingStory,
  useSaveReadingProgress,
} from '@/hooks/reading/queries';

type ReadingStoryData = NonNullable<
  Awaited<ReturnType<typeof useReadingStory>>['data']
>;

/**
 * Persists reading progress once the story data confirms the learner is on a
 * page: after an explicit page navigation (when `page` is set and the fetched
 * page matches), or on first load when the story opens directly on its last
 * page and is not yet completed. Each page is saved at most once per story
 * mount; a failed save re-arms the key so a later attempt can retry.
 */
export function useReadingProgressAutosave({
  data,
  isLastPage,
  page,
  storyUuid,
}: {
  data: ReadingStoryData | undefined;
  isLastPage: boolean;
  page: number | undefined;
  storyUuid: string;
}) {
  const saveProgress = useSaveReadingProgress(storyUuid);
  const savedPageKeysRef = useRef(new Set<string>());

  useEffect(() => {
    savedPageKeysRef.current.clear();
  }, [storyUuid]);

  useEffect(() => {
    if (!data) {
      return;
    }

    const reachedRequestedPage = page !== undefined && data.page.index === page;
    const openedOnIncompleteLastPage =
      page === undefined && isLastPage && !data.completed;
    if (!reachedRequestedPage && !openedOnIncompleteLastPage) {
      return;
    }

    const pageIndex = data.page.index;
    const key = `${storyUuid}:${pageIndex}`;
    if (savedPageKeysRef.current.has(key)) {
      return;
    }

    savedPageKeysRef.current.add(key);
    saveProgress.mutate(pageIndex, {
      onError: () => {
        savedPageKeysRef.current.delete(key);
      },
    });
  }, [data, isLastPage, page, saveProgress, storyUuid]);

  return saveProgress;
}
