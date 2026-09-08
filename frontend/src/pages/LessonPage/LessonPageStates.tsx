import { Button } from '@/components/common/Button/Button';
import { Skeleton } from '@/components/ui/skeleton';

import { LessonEmptyState } from './LessonEmptyState';

export function LessonLoadingState() {
  return (
    <div
      aria-busy="true"
      className="container-max mx-auto flex w-full flex-col space-y-4 pb-4 sm:space-y-5 lg:pb-6"
      data-testid="lesson-page"
      role="status"
    >
      <span className="sr-only">Loading lessons.</span>
      <Skeleton className="radius-section h-40 w-full" />
      <Skeleton className="radius-section h-20 w-full" />
      <Skeleton className="radius-section h-48 w-full" />
    </div>
  );
}

export function LessonErrorState({
  onRetry,
}: {
  onRetry?: () => void | Promise<unknown>;
}) {
  return (
    <LessonEmptyState
      action={
        onRetry ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => void onRetry()}
          >
            Try again
          </Button>
        ) : null
      }
      description="Something went wrong while loading your lessons. Try again in a moment."
      title="Could not load lessons"
    />
  );
}
