import { Sparkles } from 'lucide-react';
import { Link } from '@tanstack/react-router';

import { Button } from '@/components/common/Button/Button';
import { ErrorMessage } from '@/components/common/ErrorMessage/ErrorMessage';
import { ImportHomeShelf } from '@/components/reading/ImportHomeShelf';
import { ReadingHeroCard } from '@/components/reading/ReadingHeroCard';
import { ThemeSection } from '@/components/reading/ThemeSection';
import { useReadingHome } from '@/hooks/reading/queries';

export function ReadingPage() {
  const homeQuery = useReadingHome();
  const heroStory = homeQuery.data?.todaysStory ?? null;
  const themeSections = homeQuery.data?.sections ?? [];
  const visibleThemeSections = themeSections.filter(
    ({ stories }) => stories.length > 0,
  );

  const showEmptyState = visibleThemeSections.length === 0 && !heroStory;

  return (
    <div className="container-max mx-auto flex w-full flex-col gap-10 pb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="type-label text-primary-80">Reading</p>
          <p className="mt-1 type-caption text-muted-foreground">
            Read with lookup, or make a story around the words you are learning.
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="self-start sm:self-auto"
        >
          <Link to="/reading/generate">
            <Sparkles className="icon-sm" aria-hidden />
            Generate a story
          </Link>
        </Button>
      </div>
      {heroStory ? <ReadingHeroCard story={heroStory} /> : null}

      <ImportHomeShelf />

      {homeQuery.isPending ? (
        <div className="type-caption text-muted-foreground">
          Loading themes...
        </div>
      ) : homeQuery.isError ? (
        <ErrorMessage
          error="Could not load reading."
          onRetry={() => void homeQuery.refetch()}
        />
      ) : showEmptyState ? (
        <div className="radius-section border border-border bg-white-100 px-5 py-6 type-caption text-muted-foreground">
          <p>No stories available yet.</p>
          <p>Check back soon!</p>
        </div>
      ) : (
        <div className="space-y-10">
          {visibleThemeSections.map(({ group, stories }) => (
            <ThemeSection key={group.id} theme={group} stories={stories} />
          ))}
        </div>
      )}
    </div>
  );
}
