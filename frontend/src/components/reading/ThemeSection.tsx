import { Button, Heading } from '@flyt/ui';
import { ArrowRight } from 'lucide-react';
import { Link } from '@tanstack/react-router';

import { StoryCard } from '@/components/reading/StoryCard';
import type { ReadingGroup, ReadingStorySummary } from '@/types/api';

import { formatReadingNumber } from './readingDisplay';

interface ThemeSectionProps {
  theme: Pick<ReadingGroup, 'key' | 'title' | 'storyCount'>;
  stories: ReadingStorySummary[];
}

export function ThemeSection({ theme, stories }: ThemeSectionProps) {
  if (stories.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 break-words">
          <Heading as="h2" size="medium" tone="default">
            {theme.title}
          </Heading>
        </div>
        {theme.storyCount > Math.min(stories.length, 3) ? (
          <span
            className={
              theme.storyCount <= 6 && theme.storyCount <= stories.length
                ? 'shrink-0 lg:hidden'
                : 'shrink-0'
            }
          >
            <Button variant="link" size="sm" asChild>
              <Link to="/reading/themes/$key" params={{ key: theme.key }}>
                View all {formatReadingNumber(theme.storyCount)}
                <ArrowRight aria-hidden className="icon-sm shrink-0" />
              </Link>
            </Button>
          </span>
        ) : null}
      </header>

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-3 lg:gap-4">
        {stories.slice(0, 6).map((story, index) => (
          <div
            key={story.uuid}
            className={index >= 3 ? 'hidden min-w-0 lg:block' : 'min-w-0'}
          >
            <StoryCard story={story} />
          </div>
        ))}
      </div>
    </section>
  );
}
