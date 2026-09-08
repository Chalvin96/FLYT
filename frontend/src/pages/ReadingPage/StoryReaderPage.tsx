import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/common/Button/Button';
import { ErrorMessage } from '@/components/common/ErrorMessage/ErrorMessage';
import { useLookupContext } from '@/components/lookup/useLookupContext';
import { getCefrBadgeClassName } from '@/components/reading/readingDisplay';
import { StoryCard } from '@/components/reading/StoryCard';
import { buildStoryParagraphs } from '@/components/reading/storyParagraphs';
import { StoryParagraphView } from '@/components/reading/StoryParagraphView';
import { Badge } from '@/components/ui/badge';
import {
  useReadingStory,
  useReadingStoryRecommendations,
  useSaveReadingProgress,
} from '@/hooks/reading/queries';
import { getApiErrorCode } from '@/lib/apiError';
import { cn } from '@/lib/utils';
import { IMPORT_ERROR_CODES } from '@/types/api';

export function StoryReaderPage({ storyUuid }: { storyUuid: string }) {
  const [page, setPage] = useState<number | undefined>(undefined);
  const savedPageKeysRef = useRef(new Set<string>());
  const { data, isError, isPending, error, refetch } = useReadingStory(
    storyUuid,
    page,
  );
  const recommendationsQuery = useReadingStoryRecommendations(storyUuid);
  const saveProgress = useSaveReadingProgress(storyUuid);
  const { openLemma } = useLookupContext();
  const isLastPage = data ? data.page.index >= data.totalPages - 1 : false;

  useEffect(() => {
    savedPageKeysRef.current.clear();
  }, [storyUuid]);

  const persistProgress = useCallback(
    (pageIndex: number) => {
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
    },
    [saveProgress, storyUuid],
  );

  const paragraphs = useMemo(
    () => (data ? buildStoryParagraphs(data.page, data.userStates) : []),
    [data],
  );

  useEffect(() => {
    if (!data) {
      return;
    }

    if (page !== undefined) {
      if (data.page.index === page) {
        persistProgress(page);
      }
      return;
    }

    if (isLastPage && !data.completed) {
      persistProgress(data.page.index);
    }
  }, [data, isLastPage, page, persistProgress]);

  if (isPending) {
    return (
      <div className="type-caption text-muted-foreground">Loading story...</div>
    );
  }

  const isNotReady =
    isError && getApiErrorCode(error) === IMPORT_ERROR_CODES.NOT_READY;

  if (isNotReady) {
    return (
      <div
        className="mx-auto flex w-full max-w-2xl flex-col items-center gap-3 px-4 py-16 text-center"
        role="status"
        aria-live="polite"
      >
        <span className="type-label text-muted-foreground">Processing</span>
        <h1 className="type-title font-display text-foreground">
          Still processing this text
        </h1>
        <p className="type-body text-muted-foreground">
          We&apos;re turning your text into a tap-to-read story. This usually
          takes a few seconds. The page will update automatically when it&apos;s
          ready.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-2"
          onClick={() => void refetch()}
        >
          Check again
        </Button>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <ErrorMessage
        error="Could not load this story."
        onRetry={() => void refetch()}
      />
    );
  }

  const recommendations = recommendationsQuery.data?.stories ?? [];
  const goTo = (next: number) => {
    setPage(next);
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 pb-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {/* Imports have no reading group / CEFR level. */}
          {data.groupTitle ? (
            <span className="type-caption text-muted-foreground">
              {data.groupTitle}
            </span>
          ) : null}
          {data.cefrLevel ? (
            <Badge
              variant="outline"
              className={cn(
                'type-caption-sm font-semibold',
                getCefrBadgeClassName(data.cefrLevel),
              )}
            >
              {data.cefrLevel}
            </Badge>
          ) : null}
        </div>
        <h1 className="type-hero font-display">{data.title}</h1>
      </div>

      <div className="space-y-4">
        <div className="space-y-3 type-section leading-9 text-foreground">
          {paragraphs.map((paragraph, paragraphIndex) => (
            <StoryParagraphView
              key={`paragraph-${paragraphIndex}`}
              paragraph={paragraph}
              paragraphIndex={paragraphIndex}
              onOpenLemma={openLemma}
            />
          ))}
        </div>

        <div className="flex items-center gap-4 mt-6 pt-4 type-caption-sm text-muted-foreground border-t border-border">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded-full bg-warning-50" />
            New
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded-full bg-primary-40" />
            Learning
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          className="h-11 px-4"
          disabled={data.page.index === 0}
          onClick={() => goTo(data.page.index - 1)}
        >
          &larr; Prev
        </Button>
        <span className="type-caption text-muted-foreground">
          Page {data.page.index + 1} of {data.totalPages}
        </span>
        <Button
          type="button"
          variant="ghost"
          className="h-11 px-4"
          disabled={isLastPage}
          onClick={() => goTo(data.page.index + 1)}
        >
          Next &rarr;
        </Button>
      </div>

      {recommendations.length > 0 ? (
        <section className="space-y-4 pt-2">
          <h2 className="type-section">Continue Reading</h2>
          <div className="space-y-3">
            {recommendations.map((story) => (
              <StoryCard
                key={story.uuid}
                story={story}
                variant="recommendation"
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
