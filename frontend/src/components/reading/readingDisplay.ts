import type { BadgeTone } from '@flyt/ui';

import { parseUtcTimestamp } from '@/utils/date';

const LEVEL_LABELS: Record<string, string> = {
  A1: 'Beginner 1 (A1)',
  A2: 'Beginner 2 (A2)',
  B1: 'Intermediate 1 (B1)',
  B2: 'Intermediate 2 (B2)',
  C1: 'Advanced 1 (C1)',
  C2: 'Advanced 2 (C2)',
};

const LEVEL_BADGE_TONES: Record<string, BadgeTone> = {
  A1: 'success',
  A2: 'brand',
  B1: 'neutral',
  B2: 'neutral',
  C1: 'neutral',
  C2: 'neutral',
};

const READING_PUBLISHED_SHORT_DATE_FORMATTER = new Intl.DateTimeFormat(
  'en-GB',
  {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  },
);

const READING_NUMBER_FORMATTER = new Intl.NumberFormat('en-US');
const READING_COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatReadingNumber(value: number): string {
  return value >= 1_000_000
    ? READING_COMPACT_NUMBER_FORMATTER.format(value)
    : READING_NUMBER_FORMATTER.format(value);
}

export function formatReadingMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours} h ${remaining} min` : `${hours} h`;
}

export function formatReadingMinutesPhrase(minutes: number): string {
  if (minutes <= 1) return 'under a minute';
  return `${formatReadingNumber(minutes)} minutes`;
}

export function getCefrLabel(level: string | null | undefined): string {
  if (!level) {
    return 'Unknown level';
  }
  return LEVEL_LABELS[level] ?? level;
}

export function getCefrBadgeTone(level: string | null | undefined): BadgeTone {
  if (!level) {
    return LEVEL_BADGE_TONES.A1;
  }
  return LEVEL_BADGE_TONES[level] ?? LEVEL_BADGE_TONES.A1;
}

export function formatReadingPublishedShortDate(
  isoDate: string | null | undefined,
): string {
  if (!isoDate) {
    return '';
  }
  return READING_PUBLISHED_SHORT_DATE_FORMATTER.format(
    parseUtcTimestamp(isoDate),
  );
}

export function formatReadingWordCount(wordCount: number): string {
  const label = wordCount === 1 ? 'word' : 'words';
  return `${formatReadingNumber(wordCount)} ${label}`;
}

export type ReadingStatus = 'unread' | 'in_progress' | 'completed';

export function getReadingStatus(story: {
  isRead: boolean;
  completed?: boolean;
}): ReadingStatus {
  if (story.completed) {
    return 'completed';
  }
  return story.isRead ? 'in_progress' : 'unread';
}

export const READING_STATUS_LABELS: Record<
  'in_progress' | 'completed',
  string
> = {
  in_progress: 'In progress',
  completed: 'Finished',
};
