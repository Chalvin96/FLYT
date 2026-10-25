import { Card, Skeleton, Text } from '@flyt/ui';

import type { LessonDetailRead } from '@/types/api';

import { LessonDetailSession } from './LessonDetailSession';
import type { LessonCompletionDestination } from './useLessonDetailState';

type LessonDetailPageProps = {
  lesson?: LessonDetailRead;
  userId?: number;
  isError?: boolean;
  isLoading?: boolean;
  onExit?: (destination: LessonCompletionDestination) => void;
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
        <div className="h-20 w-full">
          <Skeleton data-slot="skeleton" shape="section" variant="block" />
        </div>
        <div className="grid min-h-64 w-full flex-1">
          <Skeleton data-slot="skeleton" shape="section" variant="block" />
        </div>
      </div>
    );
  }

  if (isError || !lesson) {
    return (
      <Card padding="roomy" role={isError ? 'alert' : undefined}>
        <Text size="medium" weight="semibold" tone="default">
          {isError ? 'Could not load lesson.' : 'Lesson not found.'}
        </Text>
        {isError && (
          <div className="mt-2">
            <Text size="medium" tone="subtle">
              Please try again.
            </Text>
          </div>
        )}
      </Card>
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
