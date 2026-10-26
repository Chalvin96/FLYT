import { Button, Heading, Text } from '@flyt/ui';
import { Sparkles } from 'lucide-react';
import { Link } from '@tanstack/react-router';

import { ErrorMessage } from '@/components/common/ErrorMessage/ErrorMessage';
import { ImportHomeShelf } from '@/components/reading/ImportHomeShelf';
import { ReadingHeroCard } from '@/components/reading/ReadingHeroCard';
import { ThemeSection } from '@/components/reading/ThemeSection';
import { useImports } from '@/hooks/imports/queries';
import { useReadingHome } from '@/hooks/reading/queries';
import type {
  ImportListResponse,
  ReadingHomeResponse,
  ReadingStorySummary,
} from '@/types/api';

export function ReadingPage() {
  const homeQuery = useReadingHome();
  const importsQuery = useImports({});
  const content = collectLibraryContent(
    homeQuery.data,
    importsQuery.isSuccess ? importsQuery.data : undefined,
  );
  const { starterStory } = content;

  return (
    <div className="container-max mx-auto flex w-full flex-col gap-7 pb-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Heading as="h1" size="xlarge">
            Reading
          </Heading>
          <Text as="p" size="medium" tone="subtle">
            Read with lookup, or make a story around the words you are learning.
          </Text>
        </div>
        <span className="inline-flex shrink-0 self-start sm:self-auto">
          <Button asChild variant="outline" size="sm">
            <Link to="/reading/generate">
              <Sparkles className="icon-sm" aria-hidden />
              Generate a story
            </Link>
          </Button>
        </span>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {starterStory ? <ReadingHeroCard story={starterStory} /> : null}
        <div className={starterStory ? 'min-w-0' : 'min-w-0 lg:col-span-2'}>
          <ImportHomeShelf />
        </div>
      </div>
      <LibraryStories homeQuery={homeQuery} content={content} />
    </div>
  );
}

function collectLibraryContent(
  home: ReadingHomeResponse | undefined,
  imports: ImportListResponse | undefined,
) {
  const sections = (home?.sections ?? []).filter(
    ({ stories }) => stories.length > 0,
  );
  const catalogue = sections.flatMap(({ stories }) => stories);
  const isNewLearner =
    imports != null &&
    imports.items.length === 0 &&
    imports.quota.used === 0 &&
    catalogue.every(({ isRead, completed }) => !isRead && !completed);
  const starterSection = sections.find(({ group }) => group.key === 'everyday');
  const shortestStory = starterSection?.stories
    .filter(({ cefrLevel }) => cefrLevel === 'A1')
    .reduce<ReadingStorySummary | undefined>(
      (shortest, story) =>
        !shortest || story.wordCount < shortest.wordCount ? story : shortest,
      undefined,
    );
  const starterStory =
    isNewLearner && shortestStory
      ? { ...shortestStory, groupTitle: starterSection?.group.title ?? null }
      : null;
  const showEmptyState = sections.length === 0;
  const allRead =
    catalogue.length > 0 &&
    catalogue.every(({ completed }) => completed) &&
    sections.every(({ group, stories }) => group.storyCount === stories.length);

  return { starterStory, sections, showEmptyState, allRead };
}

function LibraryStories({
  homeQuery,
  content,
}: {
  homeQuery: ReturnType<typeof useReadingHome>;
  content: ReturnType<typeof collectLibraryContent>;
}) {
  if (homeQuery.isPending) {
    return (
      <div role="status">
        <Text as="p" size="medium" tone="subtle">
          Loading stories...
        </Text>
      </div>
    );
  }
  if (homeQuery.isError) {
    return (
      <ErrorMessage
        error="Could not load reading."
        onRetry={() => void homeQuery.refetch()}
      />
    );
  }
  if (content.showEmptyState) {
    return (
      <div className="flex flex-col items-center gap-3 radius-section border border-dashed border-strong bg-overlay px-5 py-8 text-center">
        <Heading as="h2" size="medium">
          No stories available yet
        </Heading>
        <Text as="p" size="medium" tone="subtle">
          Make a story around the words you are learning.
        </Text>
      </div>
    );
  }
  return (
    <div className="space-y-7">
      {content.sections.map(({ group, stories }) => (
        <ThemeSection key={group.id} theme={group} stories={stories} />
      ))}
      {content.allRead ? (
        <Text as="p" size="small" tone="subtle">
          You&apos;ve read every story Flyt has so far.
        </Text>
      ) : null}
    </div>
  );
}
