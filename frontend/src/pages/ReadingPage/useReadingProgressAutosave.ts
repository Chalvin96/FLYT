import { useEffect, useRef } from 'react';

import { useSaveReadingProgress } from '@/hooks/reading/queries';
import type { ReadingStoryPageResponse } from '@/types/api';

export function useReadingProgressAutosave({
  data,
  isLastPage,
  page,
  storyUuid,
}: {
  data: ReadingStoryPageResponse | undefined;
  isLastPage: boolean;
  page: number | undefined;
  storyUuid: string;
}) {
  const { mutate: savePage } = useSaveReadingProgress(storyUuid);
  const savedOrPendingPageKeysRef = useRef(new Set<string>());

  useEffect(() => {
    savedOrPendingPageKeysRef.current.clear();
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
    if (savedOrPendingPageKeysRef.current.has(key)) {
      return;
    }

    savedOrPendingPageKeysRef.current.add(key);
    savePage(pageIndex, {
      onError: () => {
        savedOrPendingPageKeysRef.current.delete(key);
      },
    });
  }, [data, isLastPage, page, savePage, storyUuid]);
}
