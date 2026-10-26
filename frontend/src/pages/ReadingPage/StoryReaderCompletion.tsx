import { Button, Text } from '@flyt/ui';

import { useAddLemmasToDeck } from '@/hooks/lexicon/queries';
import {
  useAllReadingThemeStories,
  useReadingHome,
  useReadingStoryPages,
} from '@/hooks/reading/queries';
import type {
  ReadingStoryPageResponse,
  ReadingStorySummary,
} from '@/types/api';

import {
  getOtherThemes,
  getStoryContinuation,
  summarizeStoryVocabulary,
  type StoryContinuation,
  type StoryLookupWord,
} from './storyCompletion';
import { StoryEndSection } from './StoryEndSection';

export function StoryReaderCompletion({
  story,
  lookups,
  recommendations,
  onLookup,
}: {
  story: ReadingStoryPageResponse;
  lookups: readonly StoryLookupWord[];
  recommendations: readonly ReadingStorySummary[];
  onLookup: (word: StoryLookupWord) => void;
}) {
  const pages = useReadingStoryPages(story.uuid, story.totalPages);
  const theme = useAllReadingThemeStories(story.groupKey);
  const addWords = useAddLemmasToDeck();
  const completePages = pages.flatMap((query, index) =>
    query.data?.uuid === story.uuid && query.data.page.index === index
      ? [{ data: query.data, updatedAt: query.dataUpdatedAt }]
      : [],
  );
  const vocabulary =
    completePages.length === story.totalPages
      ? summarizeStoryVocabulary(completePages, lookups)
      : undefined;
  const themePages = theme.data?.pages ?? [];
  const themeGroup = themePages[0]?.group;
  const themeStories = themePages.flatMap((page) => page.stories);
  const continuation: StoryContinuation =
    themeGroup && !theme.hasNextPage && !theme.isError
      ? getStoryContinuation(story.uuid, themeGroup, themeStories)
      : { kind: 'none' };
  const home = useReadingHome(continuation.kind === 'last');
  const otherThemes =
    continuation.kind === 'last'
      ? getOtherThemes(
          continuation.theme,
          home.data?.sections.map((section) => section.group) ?? [],
        )
      : [];
  const summary = themeStories.find(
    (candidate) => candidate.uuid === story.uuid,
  );
  const wordCount = story.groupKey ? summary?.wordCount : vocabulary?.wordCount;
  const currentLookups = lookups.map((word) => ({
    ...word,
    state: word.lemmaUuid
      ? (vocabulary?.states.get(word.lemmaUuid) ?? word.state)
      : word.state,
  }));
  const incomplete = pages.filter(
    (query, index) =>
      query.data?.uuid !== story.uuid ||
      query.data.page.index !== index ||
      query.isError,
  );

  return (
    <div className="space-y-4">
      <StoryEndSection
        story={story}
        wordCount={wordCount}
        vocabulary={vocabulary}
        lookups={currentLookups}
        continuation={continuation}
        otherThemes={otherThemes}
        recommendations={recommendations.filter(
          (candidate) => candidate.uuid !== story.uuid,
        )}
        onLookup={onLookup}
        onAddWords={addWords.mutateAsync}
      />
      {incomplete.some((query) => query.isError) && (
        <div className="flex flex-wrap items-center gap-3" role="status">
          <Text size="medium" tone="subtle">
            The story&apos;s word summary couldn&apos;t load.
          </Text>
          <Button
            variant="link"
            onClick={() =>
              void Promise.all(incomplete.map((query) => query.refetch()))
            }
          >
            Try again
          </Button>
        </div>
      )}
      {story.groupKey && theme.isError && (
        <div className="flex flex-wrap items-center gap-3" role="status">
          <Text size="medium" tone="subtle">
            The next story couldn&apos;t load.
          </Text>
          <Button
            variant="link"
            onClick={() =>
              void (theme.isFetchNextPageError
                ? theme.fetchNextPage()
                : theme.refetch())
            }
          >
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
