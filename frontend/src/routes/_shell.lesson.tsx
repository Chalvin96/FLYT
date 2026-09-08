import { createFileRoute, Outlet } from '@tanstack/react-router';

import { ErrorBoundary } from '@/components/common/ErrorBoundary/ErrorBoundary';

export const Route = createFileRoute('/_shell/lesson')({
  component: Outlet,
  errorComponent: ({ error, reset }) => (
    <ErrorBoundary
      error={error}
      reset={reset}
      homeTo="/home"
      title="Lessons failed"
    />
  ),
});
