import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';

import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog';
import { useIsDesktop } from '@/hooks/ui/useIsDesktop';
import { cn } from '@/lib/utils';

import { useChatbot } from './ChatbotProvider';
import type { FlytChatbotModel } from './FlytChatbotPanel';
import { FlytChatbotPanel } from './FlytChatbotPanel';

export interface FlytChatbotLayoutProps {
  children: ReactNode;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}

export function FlytChatbotLayout({
  children,
  returnFocusRef,
}: FlytChatbotLayoutProps) {
  const isDesktop = useIsDesktop();
  const chatbotPaneRef = useRef<HTMLDivElement>(null);
  const { close, openState } = useChatbot();
  const [draft, setDraft] = useState('');
  const [selectedModel, setSelectedModel] = useState<FlytChatbotModel>('flyt');
  const isRailOpen = openState !== 'closed';
  const isDialogOpen = openState === 'open';
  const previousRailOpenRef = useRef(isRailOpen);
  const previousDesktopRef = useRef(isDesktop);

  useEffect(() => {
    const wasRailOpen = previousRailOpenRef.current;
    const wasDesktop = previousDesktopRef.current;
    const enteredDesktop = isDesktop && !wasDesktop;
    if (isDesktop && isRailOpen && (!wasRailOpen || enteredDesktop)) {
      chatbotPaneRef.current
        ?.querySelector<HTMLTextAreaElement>('textarea')
        ?.focus();
    }
    if (isDesktop && wasRailOpen && !isRailOpen) {
      returnFocusRef.current?.focus();
    }
    previousRailOpenRef.current = isRailOpen;
    previousDesktopRef.current = isDesktop;
  }, [isDesktop, isRailOpen, returnFocusRef]);

  return (
    <div id="flyt-chatbot-panel" className="contents">
      <div
        className={cn(
          'grid min-h-0 flex-1 items-stretch transition-[grid-template-columns] duration-300 ease-out motion-reduce:transition-none',
          isRailOpen
            ? 'lg:grid-cols-[minmax(0,1fr)_28rem]'
            : 'lg:grid-cols-[minmax(0,1fr)_0rem]',
        )}
      >
        {children}
        {isDesktop && (
          <aside
            aria-label="Ask Flyt chatbot"
            className={cn(
              'hidden min-h-0 min-w-0 flex-col overflow-hidden bg-card lg:flex',
              isRailOpen && 'border-l border-border/70',
            )}
            id="flyt-chatbot-desktop"
            inert={!isRailOpen}
            ref={chatbotPaneRef}
          >
            <ConnectedChatbotPanel
              draft={draft}
              onClose={close}
              onDraftChange={setDraft}
              onSelectedModelChange={setSelectedModel}
              selectedModel={selectedModel}
            />
          </aside>
        )}
      </div>
      <MobileChatbotDialog
        draft={draft}
        isOpen={isDialogOpen && !isDesktop}
        onClose={close}
        onDraftChange={setDraft}
        onSelectedModelChange={setSelectedModel}
        returnFocusRef={returnFocusRef}
        selectedModel={selectedModel}
      />
    </div>
  );
}

function ConnectedChatbotPanel({
  draft,
  onClose,
  onDraftChange,
  onSelectedModelChange,
  selectedModel,
}: {
  draft: string;
  onClose: () => void;
  onDraftChange: (draft: string) => void;
  onSelectedModelChange: (model: FlytChatbotModel) => void;
  selectedModel: FlytChatbotModel;
}) {
  const {
    context,
    dismissContext,
    dismissError,
    error,
    isLoading,
    modelAvailability,
    messages,
    retry,
    send,
    startNewConversation,
    unavailableModels,
  } = useChatbot();

  return (
    <FlytChatbotPanel
      context={context}
      draft={draft}
      error={error}
      flytRemainingPercent={modelAvailability.flyt?.remainingPercent ?? null}
      isLoading={isLoading}
      modelActions={Object.fromEntries(
        Object.entries(modelAvailability).map(([model, availability]) => [
          model,
          availability?.action ?? null,
        ]),
      )}
      modelReasons={Object.fromEntries(
        Object.entries(modelAvailability).map(([model, availability]) => [
          model,
          availability?.reason ?? null,
        ]),
      )}
      messages={messages}
      onClose={onClose}
      onContextRemove={dismissContext}
      onDraftChange={onDraftChange}
      onErrorDismiss={dismissError}
      onErrorRetry={retry}
      onModelChange={() => undefined}
      onNewConversation={startNewConversation}
      onSend={send}
      onSelectedModelChange={onSelectedModelChange}
      selectedModel={selectedModel}
      surface="pane"
      unavailableModels={unavailableModels}
    />
  );
}

function MobileChatbotDialog({
  draft,
  isOpen,
  onClose,
  onDraftChange,
  onSelectedModelChange,
  returnFocusRef,
  selectedModel,
}: {
  draft: string;
  isOpen: boolean;
  onClose: () => void;
  onDraftChange: (draft: string) => void;
  onSelectedModelChange: (model: FlytChatbotModel) => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  selectedModel: FlytChatbotModel;
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPortal>
        <DialogOverlay className="bg-black-80 lg:hidden" />
        <DialogPrimitive.Content
          aria-modal="true"
          aria-describedby="flyt-chatbot-mobile-description"
          aria-labelledby="flyt-chatbot-mobile-title"
          className="fixed inset-0 z-50 flex h-dvh min-h-0 w-full flex-col bg-background outline-none lg:hidden"
          id="flyt-chatbot-mobile"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusRef.current?.focus();
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            contentRef.current
              ?.querySelector<HTMLTextAreaElement>('textarea')
              ?.focus();
          }}
          ref={contentRef}
        >
          <DialogTitle className="sr-only" id="flyt-chatbot-mobile-title">
            Ask Flyt
          </DialogTitle>
          <DialogDescription
            className="sr-only"
            id="flyt-chatbot-mobile-description"
          >
            Ask questions about Norwegian and the current page.
          </DialogDescription>
          <ConnectedChatbotPanel
            draft={draft}
            onClose={onClose}
            onDraftChange={onDraftChange}
            onSelectedModelChange={onSelectedModelChange}
            selectedModel={selectedModel}
          />
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
