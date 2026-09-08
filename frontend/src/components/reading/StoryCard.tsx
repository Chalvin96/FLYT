import { Check, ChevronRight, CircleDot } from 'lucide-react';
import { Link } from '@tanstack/react-router';

import { AppCard } from '@/components/common/AppCard/AppCard';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ReadingStorySummary } from '@/types/api';

import {
  formatReadingPublishedDate,
  formatReadingPublishedShortDate,
  formatReadingWordCount,
  getCefrBadgeClassName,
  getCefrCoverClassName,
  getCefrLabel,
  getReadingStatus,
  getReadingStatusBadgeClassName,
  READING_STATUS_LABELS,
} from './readingDisplay';

interface StoryCardProps {
  story: ReadingStorySummary;
  variant?: 'compact' | 'list' | 'recommendation' | 'shelf';
}

function StoryStatusChip({
  story,
  className,
}: {
  story: ReadingStorySummary;
  className?: string;
}) {
  const status = getReadingStatus(story);
  if (status === 'unread') {
    return null;
  }

  const Icon = status === 'completed' ? Check : CircleDot;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 type-caption-sm font-semibold',
        getReadingStatusBadgeClassName(status),
        className,
      )}
    >
      <Icon className="icon-xs" aria-hidden />
      {READING_STATUS_LABELS[status]}
    </span>
  );
}

export function StoryCard({ story, variant = 'list' }: StoryCardProps) {
  const levelLabel = getCefrLabel(story.cefrLevel);

  if (variant === 'compact') {
    return (
      <Link
        to="/reading/story/$uuid"
        params={{ uuid: story.uuid }}
        className="group block focus-visible:outline-none"
      >
        <AppCard className="relative overflow-hidden border-border bg-white-100 p-0 transition-colors duration-200 group-hover:border-primary-70 group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background lg:flex lg:min-h-[120px]">
          <StoryStatusChip
            story={story}
            className="absolute left-2 top-2 z-10"
          />

          <div
            className={cn(
              'h-[180px] w-full shrink-0 lg:min-h-[120px] lg:w-[160px] lg:self-stretch',
              getCefrCoverClassName(story.cefrLevel),
            )}
          />

          <div className="min-w-0 flex-1 space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2 type-caption-sm text-muted-foreground">
              <Badge
                variant="outline"
                className={cn(
                  'radius-sm border px-2 py-0.5 type-caption-sm font-semibold',
                  getCefrBadgeClassName(story.cefrLevel),
                )}
              >
                {story.cefrLevel}
              </Badge>
              <span>{formatReadingPublishedShortDate(story.createdAt)}</span>
              <span>&middot; {formatReadingWordCount(story.wordCount)}</span>
            </div>

            <div className="space-y-2">
              <h3 className="font-display type-section font-semibold text-foreground">
                {story.title}
              </h3>
              <p className="type-caption leading-6 text-muted-foreground">
                {story.preview}
              </p>
            </div>
          </div>
        </AppCard>
      </Link>
    );
  }

  if (variant === 'shelf') {
    return (
      <Link
        to="/reading/story/$uuid"
        params={{ uuid: story.uuid }}
        className="group block w-[232px] shrink-0 focus-visible:outline-none sm:w-[280px]"
      >
        <AppCard className="relative flex h-full min-h-[264px] flex-col overflow-hidden border-border bg-white-100 p-0 transition-[border-color,background-color,transform] duration-200 group-hover:-translate-y-0.5 group-hover:border-primary-70 group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background sm:min-h-[292px]">
          <StoryStatusChip
            story={story}
            className="absolute right-2 top-2 z-10"
          />

          <div
            className={cn(
              'h-[120px] w-full shrink-0 sm:h-[140px]',
              getCefrCoverClassName(story.cefrLevel),
            )}
          />

          <div className="flex flex-1 flex-col gap-3 bg-white p-4">
            <div className="flex items-center gap-2 type-caption-sm text-muted-foreground">
              <Badge
                variant="outline"
                className={cn(
                  'rounded-full px-2 py-0.5 type-caption-sm font-semibold',
                  getCefrBadgeClassName(story.cefrLevel),
                )}
              >
                {story.cefrLevel}
              </Badge>
              <span>{formatReadingPublishedShortDate(story.createdAt)}</span>
            </div>

            <div className="space-y-2">
              <h3 className="type-body font-semibold text-foreground">
                {story.title}
              </h3>
              <p className="type-caption leading-6 text-muted-foreground">
                {story.preview}
              </p>
            </div>
          </div>
        </AppCard>
      </Link>
    );
  }

  if (variant === 'recommendation') {
    return (
      <Link
        to="/reading/story/$uuid"
        params={{ uuid: story.uuid }}
        className="group block focus-visible:outline-none"
      >
        <AppCard className="flex items-stretch gap-4 overflow-hidden border-border bg-white-100 p-0 transition-colors duration-200 group-hover:border-primary-70 group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background">
          <div
            className={cn(
              'flex min-h-[90px] w-[120px] shrink-0 items-end self-stretch px-3 py-2 type-caption font-semibold',
              getCefrCoverClassName(story.cefrLevel),
            )}
          >
            {story.cefrLevel}
          </div>

          <div className="min-w-0 flex-1 space-y-2 py-3 pl-0 pr-1">
            <div className="flex flex-wrap items-center gap-2 type-caption-sm text-muted-foreground">
              <StoryStatusChip story={story} />
              <Badge
                variant="outline"
                className={cn(
                  'radius-sm border px-2 py-0.5 type-caption-sm font-semibold',
                  getCefrBadgeClassName(story.cefrLevel),
                )}
              >
                {story.cefrLevel}
              </Badge>
              <span>{formatReadingPublishedShortDate(story.createdAt)}</span>
              <span>&middot; {formatReadingWordCount(story.wordCount)}</span>
            </div>

            <div className="min-w-0 space-y-1">
              <h3 className="truncate font-display type-body font-semibold text-foreground">
                {story.title}
              </h3>
              <p className="line-clamp-2 type-caption leading-5 text-muted-foreground">
                {story.preview}
              </p>
            </div>
          </div>

          <div className="flex items-center pr-4 text-primary-70 transition-transform duration-200 group-hover:translate-x-0.5">
            <ChevronRight className="icon-md" />
          </div>
        </AppCard>
      </Link>
    );
  }

  return (
    <Link
      to="/reading/story/$uuid"
      params={{ uuid: story.uuid }}
      className="group block focus-visible:outline-none"
    >
      <AppCard className="flex h-full flex-col gap-4 p-3 transition-colors duration-200 group-hover:border-primary-70 group-hover:bg-white-100 group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background sm:flex-row sm:items-start sm:p-4">
        <div
          className={cn(
            'flex h-[90px] w-full shrink-0 items-end radius-section p-3 type-caption font-semibold sm:w-[90px]',
            getCefrCoverClassName(story.cefrLevel),
          )}
        >
          {story.cefrLevel}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <h3 className="font-display type-section font-semibold text-foreground">
              {story.title}
            </h3>
            <div className="flex shrink-0 items-center gap-2">
              <StoryStatusChip story={story} />
              <Badge
                variant="outline"
                className={cn(
                  'border type-caption-sm',
                  getCefrBadgeClassName(story.cefrLevel),
                )}
              >
                {levelLabel}
              </Badge>
            </div>
          </div>

          <p className="line-clamp-2 type-caption leading-6 text-muted-foreground">
            {story.preview}
          </p>

          <p className="type-caption text-muted-foreground">
            Published {formatReadingPublishedDate(story.createdAt)}
          </p>
        </div>
      </AppCard>
    </Link>
  );
}
