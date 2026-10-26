import { createFileRoute, Outlet } from '@tanstack/react-router';

import { routeErrorComponent } from '@/lib/routeErrorComponent';

export const Route = createFileRoute('/_shell/lesson')({
  component: Outlet,
  errorComponent: routeErrorComponent('Lessons failed'),
});
