import { createFileRoute } from '@tanstack/react-router';

import { ErrorBoundary } from '@/components/common/ErrorBoundary/ErrorBoundary';
import { SessionShell } from '@/components/nav/AppShell';
import { requireShellAuth } from '@/components/routing/requireShellAuth';

export const Route = createFileRoute('/_reviewCards')({
  beforeLoad: ({ context }) => requireShellAuth(context.queryClient),
  component: () => (
    <SessionShell
      backTo="/review"
      backSearch={{ mode: 'full' }}
      backLabel="Practice"
    />
  ),
  errorComponent: ({ error, reset }) => (
    <ErrorBoundary error={error} reset={reset} homeTo="/home" />
  ),
});
