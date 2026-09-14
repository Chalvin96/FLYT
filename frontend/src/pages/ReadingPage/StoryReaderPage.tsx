import { useEffect, useMemo } from 'react';

import { useChatbotPageContext } from '@/components/chatbot/ChatbotProvider';
import { ErrorMessage } from '@/components/common/ErrorMessage/ErrorMessage';
import { useLookupContext } from '@/components/lookup/useLookupContext';
import { ReaderPagination } from '@/components/reading/ReaderPagination';
import { buildStoryParagraphs } from '@/components/reading/storyParagraphs';
import { StoryParagraphView } from '@/components/reading/StoryParagraphView';
import { StoryWordStateLegend } from '@/components/reading/StoryWordStateLegend';
import {
  usePrefetchAdjacentStoryPages,
  useReadingStory,
  useReadingStoryRecommendations,
} from '@/hooks/reading/queries';
import { getApiErrorCode } from '@/lib/apiError';
import { cn } from '@/lib/utils';
import type { ReadingStoryPageResponse } from '@/types/api';
import { IMPORT_ERROR_CODES } from '@/types/api';

import { StoryEndSection } from './StoryEndSection';
import { StoryProcessingNotice } from './StoryProcessingNotice';
import { StoryReaderHeader } from './StoryReaderHeader';
import { useReaderPageTransition } from './useReaderPageTransition';
import { useReadingProgressAutosave } from './useReadingProgressAutosave';

const STORY_TITLE_ID = 'story-reader-title';

export interface StoryReaderPageProps {
  page?: number;
  onPageChange: (page: number) => void;
  onResolvedPage?: (page: number, data: ReadingStoryPageResponse) => void;
  storyUuid: string;
}

export function StoryReaderPage({
  page,
  onPageChange,
  onResolvedPage,
  storyUuid,
}: StoryReaderPageProps) {
  const requestedIndex = page === undefined ? undefined : page - 1;
  const { data, error, isError, isPending, isPlaceholderData, refetch } =
    useReadingStory(storyUuid, requestedIndex);
  const recommendationsQuery = useReadingStoryRecommendations(storyUuid);
  const { openLemma } = useLookupContext();
  const settled = isPlaceholderData ? undefined : data;
  const isSettledLastPage =
    settled !== undefined && settled.page.index >= settled.totalPages - 1;

  useEffect(() => {
    if (page === undefined || isError || isPlaceholderData || !data) {
      return;
    }

    const resolvedPage = data.page.index + 1;
    if (resolvedPage !== page) {
      onResolvedPage?.(resolvedPage, data);
    }
  }, [data, isError, isPlaceholderData, onResolvedPage, page]);

  useReadingProgressAutosave({
    data: settled,
    isLastPage: isSettledLastPage,
    page: requestedIndex,
    storyUuid,
  });
  usePrefetchAdjacentStoryPages(
    storyUuid,
    settled?.page.index,
    settled?.totalPages,
  );
  useChatbotPageContext(
    settled
      ? {
          kind: 'reading',
          label: settled.title,
          detail: `Page ${settled.page.index + 1} of ${settled.totalPages}`,
        }
      : null,
  );

  const articleRef = useReaderPageTransition(settled?.page.index);

  const paragraphs = useMemo(
    () => (data ? buildStoryParagraphs(data.page, data.userStates) : []),
    [data],
  );

  if (isPending) {
    return (
      <div className="type-caption text-muted-foreground">Loading story...</div>
    );
  }

  const isNotReady =
    isError && getApiErrorCode(error) === IMPORT_ERROR_CODES.NOT_READY;

  if (isNotReady) {
    return <StoryProcessingNotice onRetry={() => void refetch()} />;
  }

  if (isError || !data) {
    return (
      <ErrorMessage
        error="Could not load this story."
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 pb-6">
      <article
        aria-busy={isPlaceholderData}
        aria-labelledby={STORY_TITLE_ID}
        className={cn(
          'flex flex-col gap-4 outline-none',
          isPlaceholderData && 'opacity-60',
        )}
        ref={articleRef}
        tabIndex={-1}
      >
        <StoryReaderHeader
          cefrLevel={data.cefrLevel}
          groupTitle={data.groupTitle}
          title={data.title}
          titleId={STORY_TITLE_ID}
        />

        <div
          className="space-y-3 type-section leading-9 text-foreground"
          lang="nb"
        >
          {paragraphs.map((paragraph, paragraphIndex) => (
            <StoryParagraphView
              key={`paragraph-${paragraphIndex}`}
              paragraph={paragraph}
              paragraphIndex={paragraphIndex}
              onOpenLemma={openLemma}
            />
          ))}
        </div>
        <StoryWordStateLegend className="mt-6 border-t border-border pt-4" />
      </article>

      <ReaderPagination
        requestedPage={Math.min(page ?? data.page.index + 1, data.totalPages)}
        settledPage={settled && settled.page.index + 1}
        totalPages={data.totalPages}
        onPageChange={onPageChange}
      />

      {isSettledLastPage ? (
        <StoryEndSection
          recommendations={recommendationsQuery.data?.stories ?? []}
        />
      ) : null}
    </div>
  );
}
