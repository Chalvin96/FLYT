import { createFileRoute } from '@tanstack/react-router';

import { useLessons } from '@/hooks/lessons/queries';
import { LessonPage } from '@/pages/LessonPage/LessonPage';

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

export const Route = createFileRoute('/_shell/lesson/')({
  component: LessonIndexRouteComponent,
});
