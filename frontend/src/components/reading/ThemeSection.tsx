import { ArrowRight } from 'lucide-react';
import { Link } from '@tanstack/react-router';

import { Button } from '@/components/common/Button/Button';
import { StoryCard } from '@/components/reading/StoryCard';
import type { ReadingGroup, ReadingStorySummary } from '@/types/api';

interface ThemeSectionProps {
  theme: Pick<ReadingGroup, 'key' | 'title'>;
  stories: ReadingStorySummary[];
}

export function ThemeSection({ theme, stories }: ThemeSectionProps) {
  if (stories.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-4">
        <h2 className="type-title text-foreground">{theme.title}</h2>
        <Button variant="link" asChild>
          <Link to="/reading/themes/$key" params={{ key: theme.key }}>
            View all
            <ArrowRight aria-hidden className="icon-sm shrink-0" />
          </Link>
        </Button>
      </header>

      <div className="flex gap-4 overflow-x-auto pb-2 pr-8 scroll-smooth">
        {stories.map((story) => (
          <StoryCard key={story.uuid} story={story} variant="shelf" />
        ))}
      </div>
    </section>
  );
}
