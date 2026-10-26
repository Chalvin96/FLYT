import { createFileRoute } from '@tanstack/react-router';

import { SessionShell } from '@/components/nav/AppShell';
import { requireShellAuth } from '@/components/routing/requireShellAuth';
import { routeErrorComponent } from '@/lib/routeErrorComponent';

export const Route = createFileRoute('/_lessonSession')({
  beforeLoad: ({ context }) => requireShellAuth(context.queryClient),
  component: () => <SessionShell backTo="/lesson" backLabel="Lessons" />,
  errorComponent: routeErrorComponent(),
});
