import { createFileRoute } from '@tanstack/react-router';

import { ErrorBoundary } from '@/components/common/ErrorBoundary/ErrorBoundary';
import { SessionShell } from '@/components/nav/AppShell';
import { requireShellAuth } from '@/components/routing/requireShellAuth';

export const Route = createFileRoute('/_readingTheme')({
  beforeLoad: ({ context }) => requireShellAuth(context.queryClient),
  component: () => <SessionShell backTo="/reading" backLabel="Reading" />,
  errorComponent: ({ error, reset }) => (
    <ErrorBoundary error={error} reset={reset} homeTo="/home" />
  ),
});
