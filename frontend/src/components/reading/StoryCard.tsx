import { Badge, Heading, Row, Text } from '@flyt/ui';
import { Check, ChevronRight } from 'lucide-react';
import { Link } from '@tanstack/react-router';

import type { ReadingStorySummary } from '@/types/api';

import {
  formatReadingMinutes,
  formatReadingPublishedShortDate,
  formatReadingWordCount,
  getCefrBadgeTone,
  getReadingStatus,
  READING_STATUS_LABELS,
} from './readingDisplay';

interface StoryCardProps {
  story: ReadingStorySummary;
}

function StoryMetadata({ story }: { story: ReadingStorySummary }) {
  const duration =
    story.readingMinutes > 0
      ? formatReadingMinutes(story.readingMinutes)
      : null;
  const metadata = [
    duration,
    formatReadingWordCount(story.wordCount),
    formatReadingPublishedShortDate(story.createdAt),
  ];
  const visibleMetadata = metadata.filter((value): value is string =>
    Boolean(value),
  );

  return (
    <Text as="p" size="small" tone="subtle">
      {visibleMetadata.map((value, index) => (
        <span key={value}>
          {index > 0 ? ' · ' : null}
          <Text
            as="span"
            size="small"
            tone="subtle"
            title={
              value === formatReadingWordCount(story.wordCount)
                ? `${story.wordCount.toLocaleString('en-US')} words`
                : undefined
            }
          >
            {value}
          </Text>
        </span>
      ))}
    </Text>
  );
}

export function StoryCard({ story }: StoryCardProps) {
  const status = getReadingStatus(story);

  return (
    <Row
      asChild
      size="md"
      surface="framed"
      trailing={
        <ChevronRight className="icon-sm text-icon-default" aria-hidden />
      }
    >
      <Link
        to="/reading/story/$uuid"
        params={{ uuid: story.uuid }}
        title={story.title}
      >
        <div className="space-y-1">
          {story.cefrLevel || status !== 'unread' ? (
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
              {status !== 'unread' ? (
                <span className="inline-flex items-center gap-1">
                  {status === 'completed' ? (
                    <Check className="icon-xs text-icon-success" aria-hidden />
                  ) : null}
                  <Text as="span" size="small" tone="subtle">
                    {READING_STATUS_LABELS[status]}
                  </Text>
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="line-clamp-2 break-words">
            <Heading as="h3" size="small" lang="nb" title={story.title}>
              {story.title}
            </Heading>
          </div>
          <StoryMetadata story={story} />
        </div>
      </Link>
    </Row>
  );
}
