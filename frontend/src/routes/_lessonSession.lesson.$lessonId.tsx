import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { useMe } from '@/hooks/auth/queries';
import { useLesson } from '@/hooks/lessons/queries';
import { LessonDetailPage } from '@/pages/LessonDetailPage/LessonDetailPage';

function LessonDetailRouteComponent() {
  const { lessonId } = Route.useParams();
  const navigate = useNavigate();
  const { data: user } = useMe();
  const parsedLessonId = Number(lessonId);
  const {
    data: lesson,
    isError,
    isPending: isLoading,
  } = useLesson(parsedLessonId);

  return (
    <LessonDetailPage
      isError={Number.isNaN(parsedLessonId) || isError}
      isLoading={isLoading}
      lesson={lesson}
      userId={user?.id}
      onExit={() => {
        void navigate({ to: '/lesson' });
      }}
    />
  );
}

export const Route = createFileRoute('/_lessonSession/lesson/$lessonId')({
  component: LessonDetailRouteComponent,
});
