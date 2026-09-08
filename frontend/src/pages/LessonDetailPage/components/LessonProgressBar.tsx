import { kindPosition, type LessonPage } from '@/lib/lessonPages';
import { cn } from '@/lib/utils';

type SegmentState = 'completed' | 'current' | 'locked';

type LessonProgressBarProps = {
  pages: LessonPage[];
  currentIndex: number;
  maxReachedIndex: number;
  onGoToPage?: (index: number) => void;
};

function segmentState(
  index: number,
  currentIndex: number,
  maxReachedIndex: number,
): SegmentState {
  if (index === currentIndex) {
    return 'current';
  }
  if (index <= maxReachedIndex) {
    return 'completed';
  }
  return 'locked';
}

function segmentClasses(kind: LessonPage['kind'], state: SegmentState) {
  if (kind === 'exercise') {
    switch (state) {
      case 'current':
        return 'bg-progress-primary-current';
      case 'completed':
        return 'bg-progress-primary-complete';
      default:
        return 'bg-progress-primary-locked';
    }
  }

  switch (state) {
    case 'current':
      return 'bg-progress-secondary-current';
    case 'completed':
      return 'bg-progress-secondary-complete';
    default:
      return 'bg-progress-secondary-locked';
  }
}

function segmentShape(kind: LessonPage['kind'], index: number, total: number) {
  if (kind === 'section') {
    return 'rounded-full';
  }
  return cn(
    index === 0 && 'rounded-l-full',
    index === total - 1 && 'rounded-r-full',
  );
}

function buildLabel(
  page: LessonPage,
  position: number,
  total: number,
  state: SegmentState,
) {
  const base =
    page.kind === 'exercise'
      ? `Go to practice ${position} of ${total}`
      : `Go to part ${position} of ${total}`;
  if (state === 'current') {
    return `${base}, current`;
  }
  if (state === 'locked') {
    return `${base}, locked`;
  }
  return base;
}

export function LessonProgressBar({
  pages,
  currentIndex,
  maxReachedIndex,
  onGoToPage,
}: LessonProgressBarProps) {
  const interactive = Boolean(onGoToPage);

  return (
    <div
      role={interactive ? 'group' : undefined}
      aria-label={interactive ? 'Lesson progress' : undefined}
      className={cn('flex w-full items-center gap-px', interactive && '-my-2')}
    >
      {pages.map((page, index) => {
        const state = segmentState(index, currentIndex, maxReachedIndex);
        const { position, total: kindTotal } = kindPosition(pages, index);
        const visual = cn(
          'block h-2 w-full transition-colors',
          segmentShape(page.kind, index, pages.length),
          segmentClasses(page.kind, state),
        );

        if (!onGoToPage) {
          return (
            <span
              key={page.id}
              className={visual}
              data-testid="lesson-progress-segment"
            />
          );
        }

        return (
          <button
            key={page.id}
            type="button"
            aria-label={buildLabel(page, position, kindTotal, state)}
            aria-current={state === 'current' ? 'step' : undefined}
            aria-disabled={state === 'locked' || undefined}
            onClick={state === 'locked' ? undefined : () => onGoToPage(index)}
            className={cn(
              'flex h-6 flex-1 cursor-pointer items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              state === 'locked' && 'cursor-not-allowed',
            )}
          >
            <span className={visual} data-testid="lesson-progress-segment" />
          </button>
        );
      })}
    </div>
  );
}
