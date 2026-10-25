import { createFileRoute } from '@tanstack/react-router';

import { AppShell } from '@/components/nav/AppShell';
import { requireShellAuth } from '@/components/routing/requireShellAuth';
import { routeErrorComponent } from '@/lib/routeErrorComponent';

export const Route = createFileRoute('/_shell')({
  beforeLoad: ({ context }) => requireShellAuth(context.queryClient),
  component: AppShell,
  errorComponent: routeErrorComponent(),
});
