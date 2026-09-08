import { Sparkles } from 'lucide-react';
import type { ComponentProps, ReactNode, RefObject } from 'react';
import { Link, Outlet } from '@tanstack/react-router';

import { useChatbotLauncher } from '@/components/chatbot/ChatbotLauncher';
import { ChatbotProvider } from '@/components/chatbot/ChatbotProvider';
import { FlytChatbotLayout } from '@/components/chatbot/FlytChatbotLayout';
import { BackLink } from '@/components/common/BackLink/BackLink';
import { LookupSheet } from '@/components/lookup/LookupSheet';
import { ShellBackdrop } from '@/components/nav/ShellBackdrop';
import {
  AppAccountAvatarLink,
  AppDesktopNavbar,
  AppMobileNavbar,
} from '@/components/router/AppNavbar/AppNavbar';
import { cn } from '@/lib/utils';

import { SearchIconButton } from '../router/AppNavbar/SearchIconButton';

export function AppHeader({
  leftSlot,
  hideSearch,
  onAskFlyt,
  chatbotOpen = false,
  chatbotTriggerRef,
}: {
  leftSlot?: ReactNode;
  hideSearch?: boolean;
  onAskFlyt?: () => void;
  chatbotOpen?: boolean;
  chatbotTriggerRef?: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <header className="shell-px sticky top-0 z-20 border-b border-border/60 bg-white-100 py-3">
      <div className="flex items-center justify-between gap-3 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-6">
        {/* Left: logo or back link */}
        <div className="flex items-center">
          {leftSlot ?? (
            <Link className="flex items-center text-foreground" to="/home">
              <span className="font-display type-section tracking-tight">
                Flyt
              </span>
            </Link>
          )}
        </div>

        {/* Center: dictionary search (desktop only) */}
        <div className="hidden lg:flex lg:justify-center">
          {!hideSearch && <SearchIconButton />}
        </div>

        <div className="flex items-center justify-end gap-3">
          {onAskFlyt ? (
            <button
              type="button"
              onClick={onAskFlyt}
              aria-controls="flyt-chatbot-panel"
              aria-expanded={chatbotOpen}
              aria-label="Ask Flyt"
              className={cn(
                'inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 type-caption font-semibold text-primary-90 transition-colors hover:bg-primary-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:px-4',
                chatbotOpen
                  ? 'border-primary-50 bg-primary-20'
                  : 'border-primary-30 bg-primary-10',
              )}
              ref={chatbotTriggerRef}
            >
              <Sparkles className="icon-sm" strokeWidth={2.1} />
              <span className="hidden sm:inline">Ask Flyt</span>
              <span className="sr-only sm:hidden">Ask Flyt</span>
            </button>
          ) : null}
          <div className="flex items-center gap-2 lg:hidden">
            <AppAccountAvatarLink />
          </div>
          <AppDesktopNavbar hideSearch />
        </div>
      </div>
    </header>
  );
}

export function AppShell() {
  return (
    <ChatbotProvider remote>
      <AppShellContent />
    </ChatbotProvider>
  );
}

function AppShellContent() {
  const { chatbotOpen, chatbotTriggerRef, toggleChatbot } =
    useChatbotLauncher();

  return (
    <div className="h-dvh overflow-hidden text-foreground app-grid">
      <div className="flex h-dvh w-full items-stretch justify-center">
        <div className="shell-width relative flex w-full flex-col lg:max-w-none">
          <div className="relative flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
            <ShellBackdrop />
            <AppHeader
              chatbotOpen={chatbotOpen}
              chatbotTriggerRef={chatbotTriggerRef}
              onAskFlyt={toggleChatbot}
            />

            <FlytChatbotLayout returnFocusRef={chatbotTriggerRef}>
              <main className="shell-main relative z-10 min-h-0 flex-1 overflow-y-auto">
                <Outlet />
              </main>
            </FlytChatbotLayout>

            <AppMobileNavbar />
            <LookupSheet />
          </div>
        </div>
      </div>
    </div>
  );
}

type SessionShellProps = {
  backTo: ComponentProps<typeof BackLink>['to'];
  backSearch?: Record<string, unknown>;
  backLabel: string;
};

export function SessionShell({
  backTo,
  backSearch,
  backLabel,
}: SessionShellProps) {
  return (
    <ChatbotProvider remote>
      <SessionShellContent
        backLabel={backLabel}
        backSearch={backSearch}
        backTo={backTo}
      />
    </ChatbotProvider>
  );
}

function SessionShellContent({
  backTo,
  backSearch,
  backLabel,
}: SessionShellProps) {
  const { chatbotOpen, chatbotTriggerRef, toggleChatbot } =
    useChatbotLauncher();

  return (
    <div className="h-dvh overflow-hidden text-foreground app-grid">
      <div className="flex h-dvh w-full items-stretch justify-center">
        <div className="shell-width relative flex w-full flex-col lg:max-w-none">
          <div className="relative flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
            <ShellBackdrop />
            <AppHeader
              chatbotOpen={chatbotOpen}
              hideSearch
              leftSlot={
                <BackLink
                  to={backTo}
                  search={backSearch as never}
                  className="self-start"
                >
                  {backLabel}
                </BackLink>
              }
              chatbotTriggerRef={chatbotTriggerRef}
              onAskFlyt={toggleChatbot}
            />

            <FlytChatbotLayout returnFocusRef={chatbotTriggerRef}>
              <main className="shell-main relative z-10 min-h-0 flex-1 overflow-y-auto">
                <Outlet />
              </main>
            </FlytChatbotLayout>

            <AppMobileNavbar />
            <LookupSheet />
          </div>
        </div>
      </div>
    </div>
  );
}
