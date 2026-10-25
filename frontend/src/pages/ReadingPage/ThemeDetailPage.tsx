import {
  BottomSheetDialogContent,
  Button,
  Chip,
  Dialog,
  Heading,
  Skeleton,
  Text,
} from '@flyt/ui';
import { Filter, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ErrorMessage } from '@/components/common/ErrorMessage/ErrorMessage';
import {
  FilterPanel,
  type ReadingLevelFilterOption,
} from '@/components/reading/FilterPanel';
import {
  formatReadingNumber,
  getCefrLabel,
} from '@/components/reading/readingDisplay';
import { READING_LEVELS } from '@/components/reading/readingLevels';
import { StoryCard } from '@/components/reading/StoryCard';
import {
  READING_STORIES_PAGE_SIZE,
  useInfiniteReadingStories,
} from '@/hooks/reading/queries';
import type { ReadingStorySummary } from '@/types/api';

const EMPTY_LEVEL_COUNTS: Record<string, number> = {};

export function ThemeDetailPage({
  themeKey,
  selectedLevels,
  onSelectedLevelsChange,
}: {
  themeKey: string;
  selectedLevels: string[];
  onSelectedLevelsChange: (levels: string[]) => void;
}) {
  const [hideReadStories, setHideReadStories] = useState(false);
  const [draftSelectedLevels, setDraftSelectedLevels] = useState<string[]>([]);
  const [draftHideReadStories, setDraftHideReadStories] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const storiesQuery = useInfiniteReadingStories(themeKey, {
    selectedLevels,
    showReadStories: !hideReadStories,
  });
  const { data, isError, isPending, refetch } = storiesQuery;
  const firstPage = data?.pages[0];
  const stories = data?.pages.flatMap((page) => page.stories) ?? [];
  const totalCount = firstPage?.totalCount ?? 0;
  const levelCounts = firstPage?.levelCounts ?? EMPTY_LEVEL_COUNTS;
  const levelOptions = useMemo<ReadingLevelFilterOption[]>(
    () =>
      READING_LEVELS.map((level) => ({
        value: level,
        label: getCefrLabel(level),
        count: levelCounts[level] ?? 0,
      })).filter(({ count }) => count > 0),
    [levelCounts],
  );
  const filterCount = selectedLevels.length + Number(hideReadStories);
  const filtersAvailable = totalCount > 1 || filterCount > 0;
  const matchingCount = hideReadStories
    ? undefined
    : selectedLevels.length > 0
      ? selectedLevels.reduce(
          (sum, level) => sum + (levelCounts[level] ?? 0),
          0,
        )
      : totalCount;
  const countLabel = getStoryCountLabel(stories.length, matchingCount);

  function toggleSelectedLevel(level: string) {
    onSelectedLevelsChange(
      selectedLevels.includes(level)
        ? selectedLevels.filter((item) => item !== level)
        : [...selectedLevels, level],
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
    onSelectedLevelsChange(draftSelectedLevels);
    setHideReadStories(draftHideReadStories);
    setIsMobileFiltersOpen(false);
  }
  function clearFilters() {
    onSelectedLevelsChange([]);
    setHideReadStories(false);
  }

  if (isPending)
    return (
      <div role="status">
        <Text as="p" size="medium" tone="subtle">
          Loading stories...
        </Text>
      </div>
    );
  if (isError && !data)
    return (
      <ErrorMessage
        error="Could not load reading stories."
        onRetry={() => void refetch()}
      />
    );

  return (
    <div className="container-max mx-auto w-full space-y-6 pb-10">
      <header className="space-y-3">
        <div className="break-words">
          <Heading as="h1" size="xlarge" lang="nb">
            {firstPage?.group.title}
          </Heading>
        </div>
        <Text as="p" size="medium" tone="subtle">
          {countLabel}
        </Text>
        {filtersAvailable ? (
          <div className="lg:hidden">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openMobileFilters}
              aria-haspopup="dialog"
              aria-expanded={isMobileFiltersOpen}
            >
              <Filter className="icon-sm" aria-hidden />
              Filters ({filterCount})
            </Button>
          </div>
        ) : null}
        {filterCount > 0 && stories.length > 0 ? (
          <ActiveFilterChips
            levelOptions={levelOptions}
            selectedLevels={selectedLevels}
            hideReadStories={hideReadStories}
            onToggleLevel={toggleSelectedLevel}
            onClearLevels={() => onSelectedLevelsChange([])}
            onShowRead={() => setHideReadStories(false)}
            onClearFilters={clearFilters}
          />
        ) : null}
      </header>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-5">
          <ThemeStories
            stories={stories}
            filterCount={filterCount}
            onClearFilters={clearFilters}
          />
          <ThemePagination
            query={storiesQuery}
            storiesCount={stories.length}
            matchingCount={matchingCount}
            filterCount={filterCount}
          />
        </div>
        {filtersAvailable ? (
          <div className="hidden lg:sticky lg:top-4 lg:block">
            <FilterPanel
              levelOptions={levelOptions}
              selectedLevels={selectedLevels}
              hideReadStories={hideReadStories}
              onToggleLevel={toggleSelectedLevel}
              onHideReadStoriesChange={setHideReadStories}
              mode="sidebar"
            />
          </div>
        ) : null}
      </div>
      <Dialog open={isMobileFiltersOpen} onOpenChange={setIsMobileFiltersOpen}>
        <BottomSheetDialogContent
          anchor="edge"
          height="tall"
          padding="none"
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

function ActiveFilterChips({
  levelOptions,
  selectedLevels,
  hideReadStories,
  onToggleLevel,
  onClearLevels,
  onShowRead,
  onClearFilters,
}: {
  levelOptions: ReadingLevelFilterOption[];
  selectedLevels: string[];
  hideReadStories: boolean;
  onToggleLevel: (level: string) => void;
  onClearLevels: () => void;
  onShowRead: () => void;
  onClearFilters: () => void;
}) {
  const selectedLevelSet = new Set(selectedLevels);
  const allLevelsSelected =
    levelOptions.length > 0 &&
    levelOptions.every(({ value }) => selectedLevelSet.has(value));

  return (
    <div className="flex flex-wrap items-center gap-2 lg:hidden">
      {allLevelsSelected ? (
        <Chip onClick={onClearLevels} aria-label="Remove all level filters">
          All levels <X className="icon-xs" aria-hidden />
        </Chip>
      ) : (
        selectedLevels.map((level) => (
          <Chip
            key={level}
            onClick={() => onToggleLevel(level)}
            aria-label={`Remove ${level} filter`}
          >
            {level}
            <X className="icon-xs" aria-hidden />
          </Chip>
        ))
      )}
      {hideReadStories ? (
        <Chip onClick={onShowRead} aria-label="Remove hide read filter">
          Hide read <X className="icon-xs" aria-hidden />
        </Chip>
      ) : null}
      <Button variant="link" size="sm" onClick={onClearFilters}>
        Clear all
      </Button>
    </div>
  );
}

function ThemeStories({
  stories,
  filterCount,
  onClearFilters,
}: {
  stories: ReadingStorySummary[];
  filterCount: number;
  onClearFilters: () => void;
}) {
  if (stories.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 radius-section border border-dashed border-strong bg-overlay px-5 py-8 text-center">
        <Heading as="h2" size="medium">
          {filterCount > 0 ? 'No matches' : 'No stories in this theme yet'}
        </Heading>
        <Text as="p" size="medium" tone="subtle">
          {filterCount > 0
            ? 'No stories match your level and read filters.'
            : 'Check back for new stories.'}
        </Text>
        {filterCount > 0 ? (
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:gap-4">
      {stories.map((story) => (
        <StoryCard key={story.uuid} story={story} />
      ))}
    </div>
  );
}

function ThemePagination({
  query,
  storiesCount,
  matchingCount,
  filterCount,
}: {
  query: ReturnType<typeof useInfiniteReadingStories>;
  storiesCount: number;
  matchingCount: number | undefined;
  filterCount: number;
}) {
  const {
    fetchNextPage,
    hasNextPage,
    isFetchNextPageError,
    isFetchingNextPage,
  } = query;
  const moreCount =
    matchingCount === undefined
      ? READING_STORIES_PAGE_SIZE
      : Math.min(
          READING_STORIES_PAGE_SIZE,
          Math.max(1, matchingCount - storiesCount),
        );
  const moreLabel = `Show ${matchingCount === undefined ? 'up to ' : ''}${formatReadingNumber(moreCount)} more`;
  if (isFetchNextPageError) {
    return (
      <ErrorMessage
        error="Could not load more stories."
        onRetry={() => void fetchNextPage()}
      />
    );
  }
  if (hasNextPage) {
    return (
      <>
        {isFetchingNextPage ? (
          <div aria-label="Loading more stories">
            <Skeleton shape="field" variant="block" size="3xl" />
          </div>
        ) : null}
        <div className="flex flex-col items-center gap-2">
          <Text as="p" size="small" tone="subtle">
            {getStoryCountLabel(storiesCount, matchingCount)}
          </Text>
          <div className="w-full sm:max-w-sm">
            <Button
              variant="outline"
              width="full"
              onClick={() => void fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? 'Loading...' : moreLabel}
            </Button>
          </div>
        </div>
      </>
    );
  }
  return storiesCount > 1 ? (
    <Text as="p" size="small" tone="subtle">
      {filterCount > 0
        ? `That's all ${formatReadingNumber(storiesCount)} matching stories.`
        : `That's all ${formatReadingNumber(storiesCount)} stories in this theme.`}
    </Text>
  ) : null;
}

function getStoryCountLabel(
  storiesCount: number,
  matchingCount: number | undefined,
) {
  return matchingCount === undefined
    ? `Showing ${formatReadingNumber(storiesCount)} matching ${storiesCount === 1 ? 'story' : 'stories'}`
    : `Showing ${formatReadingNumber(storiesCount)} of ${formatReadingNumber(matchingCount)} ${matchingCount === 1 ? 'story' : 'stories'}`;
}
