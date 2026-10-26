import type { ComponentProps, ReactNode } from 'react';

import { useChatbotLauncher } from '@/components/chatbot/ChatbotLauncher';
import { FlytChatbotLayout } from '@/components/chatbot/FlytChatbotLayout';
import { useIsDesktop } from '@/hooks/ui/useIsDesktop';

import { StoryReaderHeader } from './StoryReaderHeader';

export function StoryReaderLayout({
  children,
  rail,
  footer,
  ...header
}: Pick<
  ComponentProps<typeof StoryReaderHeader>,
  'title' | 'page' | 'totalPages' | 'finished' | 'loading'
> & { children: ReactNode; rail?: ReactNode; footer?: ReactNode }) {
  const { chatbotOpen, chatbotTriggerRef, toggleChatbot } =
    useChatbotLauncher();
  const isDesktop = useIsDesktop();

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <StoryReaderHeader
        {...header}
        chatbotOpen={chatbotOpen}
        chatbotPanelId={
          isDesktop ? 'flyt-chatbot-panel' : 'flyt-chatbot-mobile'
        }
        chatbotTriggerRef={chatbotTriggerRef}
        onAskFlyt={toggleChatbot}
      />
      <FlytChatbotLayout returnFocusRef={chatbotTriggerRef}>
        <div className="flex min-h-0 min-w-0">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <main
              className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8"
              data-testid="reader-scroll"
            >
              {children}
            </main>
            {footer && (
              <footer className="shrink-0 border-t border-default bg-raised">
                {footer}
              </footer>
            )}
          </div>
          {rail && isDesktop && !chatbotOpen && (
            <aside
              aria-label="Words on this page"
              className="hidden min-h-0 w-80 shrink-0 flex-col border-l border-default bg-raised lg:flex"
            >
              {rail}
            </aside>
          )}
        </div>
      </FlytChatbotLayout>
    </div>
  );
}
