import { Button, Skeleton } from '@flyt/ui';

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
      <Skeleton shape="section" variant="block" size="lg" />
      <Skeleton shape="section" variant="block" size="md" />
      <Skeleton shape="section" variant="block" size="2xl" />
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
