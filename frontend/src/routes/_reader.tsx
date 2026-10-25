import { createFileRoute, Outlet } from '@tanstack/react-router';

import { ChatbotProvider } from '@/components/chatbot/ChatbotProvider';
import { requireShellAuth } from '@/components/routing/requireShellAuth';
import { useMe } from '@/hooks/auth/queries';
import { routeErrorComponent } from '@/lib/routeErrorComponent';

function ReaderShell() {
  const { data: user } = useMe();
  return (
    <ChatbotProvider accountId={user?.id ?? null} remote>
      <div className="relative flex h-dvh flex-col overflow-hidden bg-neutral">
        <Outlet />
      </div>
    </ChatbotProvider>
  );
}

export const Route = createFileRoute('/_reader')({
  beforeLoad: ({ context }) => requireShellAuth(context.queryClient),
  component: ReaderShell,
  errorComponent: routeErrorComponent(),
});
