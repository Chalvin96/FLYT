import type { ReactNode } from 'react';

import { AppCard } from '@/components/common/AppCard/AppCard';
import { kindPosition, type LessonPage } from '@/lib/lessonPages';

import { LessonProgressBar } from './LessonProgressBar';

type LessonLayoutProps = {
  title: string;
  progressCurrent: number;
  totalPages: number;
  progressPercent: number;
  pages?: LessonPage[] | null;
  maxReachedIndex?: number;
  onGoToPage?: (index: number) => void;
  children: ReactNode;
};

function LessonProgressHeader({
  title,
  progressCurrent,
  totalPages,
  progressPercent,
  pages,
  maxReachedIndex,
  onGoToPage,
}: Omit<LessonLayoutProps, 'children'>) {
  const hasSegments = Boolean(pages?.length);
  const label = pages ? kindPosition(pages, progressCurrent) : null;
  const labelTotal = label?.total || totalPages;
  const labelPosition = label?.position ?? progressCurrent + 1;
  const isComplete = progressCurrent >= totalPages;
  const pageNow = Math.min(progressCurrent + 1, totalPages);
  const progressbar = {
    'aria-label': 'Lesson page progress',
    'aria-valuemax': totalPages,
    'aria-valuemin': 0,
    'aria-valuenow': pageNow,
    'aria-valuetext': isComplete
      ? 'Complete'
      : `Page ${pageNow} of ${totalPages}`,
    role: 'progressbar',
  } as const;

  return (
    <AppCard className="p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <p className="type-label text-muted-foreground">Lesson</p>
          <h1 className="line-clamp-2 type-section font-semibold text-foreground">
            {title}
          </h1>
        </div>
        <p
          aria-live="polite"
          className="type-caption text-muted-foreground sm:shrink-0"
        >
          {isComplete
            ? 'Complete'
            : `${pages?.[progressCurrent]?.kind === 'exercise' ? 'Practice' : 'Part'} ${labelPosition} of ${labelTotal}`}
        </p>
      </div>
      <div className="mt-3">
        {hasSegments && pages ? (
          <>
            <div className="sr-only" {...progressbar} />
            <LessonProgressBar
              pages={pages}
              currentIndex={progressCurrent}
              maxReachedIndex={maxReachedIndex ?? progressCurrent}
              onGoToPage={onGoToPage}
            />
          </>
        ) : (
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-progress-primary-locked"
            {...progressbar}
          >
            <div
              className="h-full origin-left rounded-full bg-progress-primary-complete transition-transform duration-300 ease-out"
              style={{ transform: `scaleX(${progressPercent / 100})` }}
            />
          </div>
        )}
      </div>
    </AppCard>
  );
}

export function LessonLayout({
  title,
  progressCurrent,
  totalPages,
  progressPercent,
  pages,
  maxReachedIndex,
  onGoToPage,
  children,
}: LessonLayoutProps) {
  return (
    <div className="container-max mx-auto flex h-full min-h-0 w-full flex-col gap-3 pb-3">
      <LessonProgressHeader
        title={title}
        progressCurrent={progressCurrent}
        totalPages={totalPages}
        progressPercent={progressPercent}
        pages={pages}
        maxReachedIndex={maxReachedIndex}
        onGoToPage={onGoToPage}
      />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
