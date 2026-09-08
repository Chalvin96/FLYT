import { useLessons } from '@/hooks/lessons/queries';

import { LessonPage } from './LessonPage';

export function LessonIndexRouteComponent() {
  const { data: lessons, isError, isPending, refetch } = useLessons();

  return (
    <LessonPage
      isError={isError}
      isLoading={isPending}
      lessons={lessons}
      onRetry={refetch}
    />
  );
}
