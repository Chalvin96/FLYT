const LEVEL_LABELS: Record<string, string> = {
  A1: 'Beginner 1 (A1)',
  A2: 'Beginner 2 (A2)',
  B1: 'Intermediate 1 (B1)',
  B2: 'Intermediate 2 (B2)',
};

const LEVEL_COVER_CLASS_NAMES: Record<string, string> = {
  A1: 'bg-accent-50 text-accent-100',
  A2: 'bg-primary-70 text-white-100',
  B1: 'bg-secondary-60 text-white-100',
  B2: 'bg-warning-60 text-white-100',
};

const LEVEL_BADGE_CLASS_NAMES: Record<string, string> = {
  A1: 'border-accent-50 bg-accent-10 text-accent-100',
  A2: 'border-primary-40 bg-primary-10 text-primary-100',
  B1: 'border-secondary-40 bg-secondary-10 text-secondary-100',
  B2: 'border-warning-30 bg-warning-10 text-warning-100',
};

const READING_PUBLISHED_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const READING_PUBLISHED_SHORT_DATE_FORMATTER = new Intl.DateTimeFormat(
  'en-US',
  {
    month: 'short',
    day: 'numeric',
  },
);

export function getCefrLabel(level: string | null | undefined): string {
  if (!level) {
    return 'Unknown level';
  }
  return LEVEL_LABELS[level] ?? level;
}

export function getCefrCoverClassName(
  level: string | null | undefined,
): string {
  if (!level) {
    return LEVEL_COVER_CLASS_NAMES.A1;
  }
  return LEVEL_COVER_CLASS_NAMES[level] ?? LEVEL_COVER_CLASS_NAMES.A1;
}

export function getCefrBadgeClassName(
  level: string | null | undefined,
): string {
  if (!level) {
    return LEVEL_BADGE_CLASS_NAMES.A1;
  }
  return LEVEL_BADGE_CLASS_NAMES[level] ?? LEVEL_BADGE_CLASS_NAMES.A1;
}

export function formatReadingPublishedDate(
  isoDate: string | null | undefined,
): string {
  if (!isoDate) {
    return '-';
  }
  return READING_PUBLISHED_DATE_FORMATTER.format(new Date(isoDate));
}

export function formatReadingPublishedShortDate(
  isoDate: string | null | undefined,
): string {
  if (!isoDate) {
    return '-';
  }
  return READING_PUBLISHED_SHORT_DATE_FORMATTER.format(new Date(isoDate));
}

export function formatReadingWordCount(wordCount: number): string {
  const label = wordCount === 1 ? 'word' : 'words';
  return `${wordCount.toLocaleString()} ${label}`;
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

const STATUS_BADGE_CLASS_NAMES: Record<'in_progress' | 'completed', string> = {
  in_progress: 'border-warning-30 bg-warning-10 text-warning-100',
  completed: 'border-primary-40 bg-primary-10 text-primary-100',
};

export function getReadingStatusBadgeClassName(
  status: 'in_progress' | 'completed',
): string {
  return STATUS_BADGE_CLASS_NAMES[status];
}

export const READING_STATUS_LABELS: Record<
  'in_progress' | 'completed',
  string
> = {
  in_progress: 'In progress',
  completed: 'Completed',
};
