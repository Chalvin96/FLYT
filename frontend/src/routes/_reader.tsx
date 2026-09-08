import { createFileRoute, Outlet } from '@tanstack/react-router';

import { useChatbotLauncher } from '@/components/chatbot/ChatbotLauncher';
import { ChatbotProvider } from '@/components/chatbot/ChatbotProvider';
import { FlytChatbotLayout } from '@/components/chatbot/FlytChatbotLayout';
import { BackLink } from '@/components/common/BackLink/BackLink';
import { ErrorBoundary } from '@/components/common/ErrorBoundary/ErrorBoundary';
import { LookupSheet } from '@/components/lookup/LookupSheet';
import { AppHeader } from '@/components/nav/AppShell';
import { ShellBackdrop } from '@/components/nav/ShellBackdrop';
import { ReaderDefinitionPanel } from '@/components/reading/ReaderDefinitionPanel';
import { AppMobileNavbar } from '@/components/router/AppNavbar/AppNavbar';
import { requireShellAuth } from '@/components/routing/requireShellAuth';
import { useIsDesktop } from '@/hooks/ui/useIsDesktop';

function ReaderShell() {
  return (
    <ChatbotProvider remote>
      <ReaderShellContent />
    </ChatbotProvider>
  );
}

function ReaderShellContent() {
  const isDesktop = useIsDesktop();
  const { chatbotOpen, chatbotTriggerRef, toggleChatbot } =
    useChatbotLauncher();
  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-background">
      <ShellBackdrop />
      <AppHeader
        chatbotOpen={chatbotOpen}
        leftSlot={
          <BackLink to="/reading" className="-ml-3">
            Back
          </BackLink>
        }
        chatbotTriggerRef={chatbotTriggerRef}
        onAskFlyt={toggleChatbot}
      />
      <FlytChatbotLayout returnFocusRef={chatbotTriggerRef}>
        <div className="flex min-h-0 flex-1">
          <main className="shell-main relative z-10 min-h-0 flex-1 overflow-y-auto">
            <Outlet />
          </main>
          {isDesktop && (
            <aside className="w-80 shrink-0 overflow-y-auto border-l border-border bg-card">
              <ReaderDefinitionPanel />
            </aside>
          )}
        </div>
      </FlytChatbotLayout>
      {!isDesktop && <AppMobileNavbar />}
      <LookupSheet />
    </div>
  );
}

export const Route = createFileRoute('/_reader')({
  beforeLoad: ({ context }) => requireShellAuth(context.queryClient),
  component: ReaderShell,
  errorComponent: ({ error, reset }) => (
    <ErrorBoundary error={error} reset={reset} homeTo="/home" />
  ),
});
