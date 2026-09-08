import { createFileRoute } from '@tanstack/react-router';

import { ErrorBoundary } from '@/components/common/ErrorBoundary/ErrorBoundary';
import { SessionShell } from '@/components/nav/AppShell';
import { requireShellAuth } from '@/components/routing/requireShellAuth';

export const Route = createFileRoute('/_lessonSession')({
  beforeLoad: ({ context }) => requireShellAuth(context.queryClient),
  component: () => <SessionShell backTo="/lesson" backLabel="Lessons" />,
  errorComponent: ({ error, reset }) => (
    <ErrorBoundary error={error} reset={reset} homeTo="/home" />
  ),
});
