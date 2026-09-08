import { createFileRoute } from '@tanstack/react-router';

import { LessonIndexRouteComponent } from '@/pages/LessonPage/LessonIndexRouteComponent';

export const Route = createFileRoute('/_shell/lesson/')({
  component: LessonIndexRouteComponent,
});
