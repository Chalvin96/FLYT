import { Card, Heading, Text } from '@flyt/ui';
import type { ReactNode } from 'react';

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
    <Card padding="compact">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <Heading as="div" size="xxsmall" tone="subtle">
            Lesson
          </Heading>
          <div className="line-clamp-2">
            <Heading as="h1" size="medium" tone="default">
              {title}
            </Heading>
          </div>
        </div>
        <div className="text-subtle sm:shrink-0">
          <Text as="p" size="medium" aria-live="polite">
            {isComplete
              ? 'Complete'
              : `${pages?.[progressCurrent]?.kind === 'exercise' ? 'Practice' : 'Part'} ${labelPosition} of ${labelTotal}`}
          </Text>
        </div>
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
            className="h-2 w-full overflow-hidden rounded-full bg-progress-locked"
            {...progressbar}
          >
            <div
              className="h-full w-full rounded-full border border-[var(--progress-border)] bg-progress-primary-complete transition-[clip-path] duration-300 ease-out"
              style={{
                clipPath: `inset(0 calc(100% - ${progressPercent}%) 0 0 round 9999px)`,
              }}
            />
          </div>
        )}
      </div>
    </Card>
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
