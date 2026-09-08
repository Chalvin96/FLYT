import { Link } from '@tanstack/react-router';

import { BaseHeroCard } from '@/components/common/BaseHeroCard/BaseHeroCard';
import { DecoReading } from '@/components/common/BaseHeroCard/decorations';
import { Button } from '@/components/common/Button/Button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ReadingHeroStory } from '@/types/api';

import { getCefrBadgeClassName } from './readingDisplay';

interface ReadingHeroCardProps {
  story: ReadingHeroStory;
}

export function ReadingHeroCard({ story }: ReadingHeroCardProps) {
  const subtitle = story.preview;

  return (
    <BaseHeroCard
      className="bg-secondary-80 text-white-100"
      label="Today's Story"
      labelClass="text-white-60"
      badge="Reading"
      badgeClass="bg-white-20 text-white-100"
      title={story.title}
      subtitle={subtitle}
      subtitleClass="text-white-70"
      decoration={<DecoReading />}
      details={
        <div className="flex flex-wrap items-center gap-3">
          <Badge
            variant="outline"
            className={cn(
              'rounded-full px-2 py-0.5 type-caption-sm font-semibold',
              getCefrBadgeClassName(story.cefrLevel),
            )}
          >
            {story.cefrLevel}
          </Badge>
          <span className="type-caption text-white-70">{story.groupTitle}</span>
        </div>
      }
      primaryAction={
        <Button
          asChild
          className="w-full bg-white-100 text-secondary-90 hover:bg-white-90 sm:w-auto"
          size="sm"
        >
          <Link to="/reading/story/$uuid" params={{ uuid: story.uuid }}>
            Start reading
          </Link>
        </Button>
      }
    />
  );
}
