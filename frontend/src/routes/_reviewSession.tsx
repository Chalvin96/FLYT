import { createFileRoute } from '@tanstack/react-router';

import { ErrorBoundary } from '@/components/common/ErrorBoundary/ErrorBoundary';
import { SessionShell } from '@/components/nav/AppShell';
import { requireShellAuth } from '@/components/routing/requireShellAuth';

export const Route = createFileRoute('/_reviewSession')({
  beforeLoad: ({ context }) => requireShellAuth(context.queryClient),
  component: () => <SessionShell backTo="/review" backLabel="Review" />,
  errorComponent: ({ error, reset }) => (
    <ErrorBoundary error={error} reset={reset} homeTo="/home" />
  ),
});
