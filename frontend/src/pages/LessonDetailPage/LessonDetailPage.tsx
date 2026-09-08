import { AppCard } from '@/components/common/AppCard/AppCard';
import { Skeleton } from '@/components/ui/skeleton';
import type { LessonDetailRead } from '@/types/api';

import { LessonDetailSession } from './LessonDetailSession';

type LessonDetailPageProps = {
  lesson?: LessonDetailRead;
  userId?: number;
  isError?: boolean;
  isLoading?: boolean;
  onExit?: () => void;
};

export function LessonDetailPage({
  lesson,
  userId,
  isError = false,
  isLoading = false,
  onExit,
}: LessonDetailPageProps) {
  if (isLoading) {
    return (
      <div
        aria-busy="true"
        className="container-max mx-auto flex h-full w-full flex-col gap-4 pb-3"
        role="status"
      >
        <span className="sr-only">Loading lesson.</span>
        <Skeleton className="radius-section h-20 w-full" data-slot="skeleton" />
        <Skeleton
          className="radius-section h-full min-h-64 w-full"
          data-slot="skeleton"
        />
      </div>
    );
  }

  if (isError || !lesson) {
    return (
      <AppCard className="p-6" role={isError ? 'alert' : undefined}>
        <p className="type-caption font-semibold text-foreground">
          {isError ? 'Could not load lesson.' : 'Lesson not found.'}
        </p>
        {isError && (
          <p className="mt-2 type-caption text-muted-foreground">
            Please try again.
          </p>
        )}
      </AppCard>
    );
  }

  return (
    <LessonDetailSession
      key={lesson.id}
      lesson={lesson}
      userId={userId}
      onExit={onExit}
    />
  );
}
