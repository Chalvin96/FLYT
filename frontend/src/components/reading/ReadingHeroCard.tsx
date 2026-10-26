import { Badge, Button, Heading, Text } from '@flyt/ui';
import { Link } from '@tanstack/react-router';

import type { ReadingHeroStory } from '@/types/api';

import {
  formatReadingMinutes,
  formatReadingWordCount,
  getCefrBadgeTone,
} from './readingDisplay';

interface ReadingHeroCardProps {
  story: ReadingHeroStory;
}

export function ReadingHeroCard({ story }: ReadingHeroCardProps) {
  return (
    <section className="space-y-3 radius-section border border-brand-subtle bg-brand-subtle p-4 sm:p-5">
      <Text as="p" size="small" weight="semibold" tone="selected">
        Start here
      </Text>
      <div className="line-clamp-2 break-words">
        <Heading as="h2" size="medium" lang="nb" title={story.title}>
          {story.title}
        </Heading>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {story.cefrLevel ? (
          <Badge
            shape="pill"
            size="sm"
            tone={getCefrBadgeTone(story.cefrLevel)}
          >
            {story.cefrLevel}
          </Badge>
        ) : null}
        <Text as="span" size="small" tone="default">
          {[
            story.readingMinutes > 0
              ? formatReadingMinutes(story.readingMinutes)
              : null,
            formatReadingWordCount(story.wordCount),
            story.groupTitle,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </div>
      <Button asChild size="md" width="full-on-mobile">
        <Link to="/reading/story/$uuid" params={{ uuid: story.uuid }}>
          Start reading
        </Link>
      </Button>
    </section>
  );
}
