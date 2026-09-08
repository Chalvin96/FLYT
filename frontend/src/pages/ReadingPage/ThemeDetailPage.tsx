import { Filter } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { BottomSheetDialogContent } from '@/components/common/BottomSheetDialogContent/BottomSheetDialogContent';
import { Button } from '@/components/common/Button/Button';
import { ErrorMessage } from '@/components/common/ErrorMessage/ErrorMessage';
import {
  FilterPanel,
  type ReadingLevelFilterOption,
} from '@/components/reading/FilterPanel';
import { getCefrLabel } from '@/components/reading/readingDisplay';
import { StoryCard } from '@/components/reading/StoryCard';
import { Dialog } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useInfiniteReadingStories } from '@/hooks/reading/queries';

const LEVELS = ['A1', 'A2', 'B1', 'B2'] as const;

const EMPTY_LEVEL_COUNTS: Record<string, number> = {};

export function ThemeDetailPage({ themeKey }: { themeKey: string }) {
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [hideReadStories, setHideReadStories] = useState(false);
  const [draftSelectedLevels, setDraftSelectedLevels] = useState<string[]>([]);
  const [draftHideReadStories, setDraftHideReadStories] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isPending,
    refetch,
  } = useInfiniteReadingStories(themeKey, {
    selectedLevels,
    showReadStories: !hideReadStories,
  });

  const themeTitle = data?.pages[0]?.group.title ?? '';
  const allStories = useMemo(
    () => data?.pages.flatMap((page) => page.stories) ?? [],
    [data?.pages],
  );
  const totalCount = data?.pages[0]?.totalCount ?? 0;
  const levelCounts = data?.pages[0]?.levelCounts ?? EMPTY_LEVEL_COUNTS;

  const levelOptions = useMemo<ReadingLevelFilterOption[]>(() => {
    return LEVELS.map((level) => ({
      value: level,
      label: getCefrLabel(level),
      count: levelCounts[level] ?? 0,
    })).filter((level) => level.count > 0);
  }, [levelCounts]);

  const stories = allStories;

  useEffect(() => {
    const node = loadMoreRef.current;

    if (
      node === null ||
      !hasNextPage ||
      isFetchingNextPage ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void fetchNextPage();
        }
      },
      { rootMargin: '240px 0px' },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  function toggleSelectedLevel(level: string) {
    setSelectedLevels((current) =>
      current.includes(level)
        ? current.filter((item) => item !== level)
        : [...current, level],
    );
  }

  function toggleDraftLevel(level: string) {
    setDraftSelectedLevels((current) =>
      current.includes(level)
        ? current.filter((item) => item !== level)
        : [...current, level],
    );
  }

  function openMobileFilters() {
    setDraftSelectedLevels(selectedLevels);
    setDraftHideReadStories(hideReadStories);
    setIsMobileFiltersOpen(true);
  }

  function applyMobileFilters() {
    setSelectedLevels(draftSelectedLevels);
    setHideReadStories(draftHideReadStories);
    setIsMobileFiltersOpen(false);
  }

  if (isPending) {
    return (
      <div className="type-caption text-muted-foreground">
        Loading stories...
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorMessage
        error="Could not load reading stories."
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="bg-background">
      <div className="container-max mx-auto w-full space-y-5 pb-10">
        <header className="-mx-4 border-b border-border bg-white-100 px-4 py-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:border-b-0 lg:bg-transparent lg:px-0 lg:py-0">
          <h1 className="font-display type-hero font-semibold text-foreground">
            {themeTitle}
          </h1>
          <p className="mt-1 type-caption text-muted-foreground lg:hidden">
            {stories.length} of {totalCount} stories
          </p>
          <p className="mt-1 hidden type-caption text-muted-foreground lg:block">
            Showing {stories.length} of {totalCount} stories
          </p>
        </header>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1 space-y-4">
            {totalCount === 0 ? (
              <div className="radius-field border border-border bg-white-100 px-5 py-8 text-center type-caption text-muted-foreground">
                No stories available in this theme yet.
              </div>
            ) : null}

            {totalCount > 0 && stories.length === 0 ? (
              <div className="radius-field border border-border bg-white-100 px-5 py-8 text-center type-caption text-muted-foreground">
                No stories match the current filters.
              </div>
            ) : null}

            {stories.map((story) => (
              <StoryCard key={story.uuid} story={story} variant="compact" />
            ))}

            {isFetchingNextPage ? (
              <div className="space-y-4" aria-label="Loading more stories">
                <Skeleton className="h-[18rem] radius-field" />
                <Skeleton className="h-[18rem] radius-field" />
              </div>
            ) : null}

            {hasNextPage ? <div ref={loadMoreRef} className="h-1" /> : null}
          </div>

          <div className="hidden lg:block">
            <FilterPanel
              levelOptions={levelOptions}
              selectedLevels={selectedLevels}
              hideReadStories={hideReadStories}
              onToggleLevel={toggleSelectedLevel}
              onHideReadStoriesChange={setHideReadStories}
              mode="sidebar"
            />
          </div>
        </div>
      </div>

      {!isMobileFiltersOpen ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="fixed bottom-6 right-6 z-40 size-14 rounded-full border-border bg-white-100 text-primary-70 shadow-raised hover:bg-white-100 lg:hidden"
          aria-label="Open filters"
          onClick={openMobileFilters}
        >
          <Filter className="icon-md" />
        </Button>
      ) : null}

      <Dialog open={isMobileFiltersOpen} onOpenChange={setIsMobileFiltersOpen}>
        <BottomSheetDialogContent
          className="inset-x-0 bottom-0 max-h-[var(--sheet-max-height-tall)] max-w-none rounded-b-none rounded-t-[1.5rem] border-x-0 border-b-0 px-0 sm:inset-x-0 sm:bottom-0 sm:left-0 sm:right-0 sm:rounded-b-none"
          showCloseButton
        >
          <FilterPanel
            levelOptions={levelOptions}
            selectedLevels={draftSelectedLevels}
            hideReadStories={draftHideReadStories}
            onToggleLevel={toggleDraftLevel}
            onHideReadStoriesChange={setDraftHideReadStories}
            mode="sheet"
            onApply={applyMobileFilters}
          />
        </BottomSheetDialogContent>
      </Dialog>
    </div>
  );
}
