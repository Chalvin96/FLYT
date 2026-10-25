import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@flyt/ui';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';

import { CHATBOT_MODEL_IDS } from '@/api/chatbot';
import type { AccountPageAnchor } from '@/components/nav/accountNavigation';
import { cn } from '@/lib/utils';

import { useChatbot } from './ChatbotProvider';
import type { FlytChatbotModel } from './FlytChatbotPanel';
import { FlytChatbotPanel } from './FlytChatbotPanel';
import { CHATBOT_ERROR_SOURCES, CHATBOT_OPEN_STATES } from './types';
import { useChatbotOpenState } from './useChatbotOpenState';
import { useRailPresence } from './useRailPresence';

export interface FlytChatbotLayoutProps {
  children: ReactNode;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}

function navigateToAccount(anchor: AccountPageAnchor) {
  window.location.assign(`/account#${anchor}`);
}

export function FlytChatbotLayout({
  children,
  returnFocusRef,
}: FlytChatbotLayoutProps) {
  const { close, isDesktop, isDialogOpen, isRailOpen, openState } =
    useChatbotOpenState();
  const { reserved, visible } = useRailPresence(isRailOpen, isDesktop);
  const chatbotPaneRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');
  const [selectedModel, setSelectedModel] = useState<FlytChatbotModel>(
    CHATBOT_MODEL_IDS.FLYT,
  );
  const previousRailOpenRef = useRef(isRailOpen);
  const previousDesktopRef = useRef(isDesktop);
  const previousVisibleRef = useRef(visible);

  useEffect(() => {
    const wasRailOpen = previousRailOpenRef.current;
    if (isDesktop && wasRailOpen && !isRailOpen) {
      returnFocusRef.current?.focus();
    }
    previousRailOpenRef.current = isRailOpen;
  }, [isDesktop, isRailOpen, returnFocusRef]);

  useEffect(() => {
    const enteredDesktop = isDesktop && !previousDesktopRef.current;
    previousDesktopRef.current = isDesktop;
    const wasVisible = previousVisibleRef.current;
    previousVisibleRef.current = visible;

    if (!isDesktop || !visible) return;
    if (wasVisible && !enteredDesktop) return;
    if (openState === CHATBOT_OPEN_STATES.AUTO) return;

    chatbotPaneRef.current
      ?.querySelector<HTMLTextAreaElement>('textarea')
      ?.focus();
  }, [isDesktop, openState, visible]);

  const handleOpenAccountSettings = (anchor: AccountPageAnchor) => {
    if (!isDesktop) close();
    navigateToAccount(anchor);
  };

  return (
    <div id="flyt-chatbot-panel" className="contents">
      <div
        className={cn(
          'grid min-h-0 flex-1 items-stretch overflow-hidden',
          reserved
            ? 'lg:grid-cols-[minmax(0,1fr)_28rem]'
            : 'lg:grid-cols-[minmax(0,1fr)_0rem]',
        )}
        data-testid="flyt-chatbot-grid"
      >
        {children}
        {isDesktop && (
          <aside
            aria-label="Ask Flyt chatbot"
            className={cn(
              'hidden min-h-0 min-w-0 flex-col overflow-hidden bg-raised lg:flex',
              'transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none',
              visible
                ? 'translate-x-0 opacity-100'
                : 'translate-x-full opacity-0',
              visible && 'border-l border-default/70',
            )}
            data-rail-reserved={reserved ? 'true' : 'false'}
            data-rail-state={
              visible ? CHATBOT_OPEN_STATES.OPEN : CHATBOT_OPEN_STATES.CLOSED
            }
            id="flyt-chatbot-desktop"
            inert={!visible}
            ref={chatbotPaneRef}
          >
            <ConnectedChatbotPanel
              draft={draft}
              onClose={close}
              onDraftChange={setDraft}
              onOpenAccountSettings={handleOpenAccountSettings}
              onSelectedModelChange={setSelectedModel}
              selectedModel={selectedModel}
            />
          </aside>
        )}
      </div>
      <MobileChatbotDialog
        draft={draft}
        isOpen={isDialogOpen}
        onClose={close}
        onDraftChange={setDraft}
        onOpenAccountSettings={handleOpenAccountSettings}
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
  onOpenAccountSettings,
  onSelectedModelChange,
  selectedModel,
}: {
  draft: string;
  onClose: () => void;
  onDraftChange: (draft: string) => void;
  onOpenAccountSettings: (anchor: AccountPageAnchor) => void;
  onSelectedModelChange: (model: FlytChatbotModel) => void;
  selectedModel: FlytChatbotModel;
}) {
  const {
    availabilityStatus,
    context,
    dismissContext,
    dismissError,
    error,
    errorSource,
    isLoading,
    modelAvailability,
    messages,
    retry,
    retryAvailability,
    send,
    startNewConversation,
    unavailableModels,
  } = useChatbot();

  return (
    <FlytChatbotPanel
      availabilityStatus={availabilityStatus}
      context={context}
      draft={draft}
      error={error}
      flytRemainingPercent={
        modelAvailability[CHATBOT_MODEL_IDS.FLYT]?.remainingPercent ?? null
      }
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
      onErrorDismiss={errorSource ? dismissError : undefined}
      onErrorRetry={
        errorSource === CHATBOT_ERROR_SOURCES.REQUEST
          ? retry
          : errorSource === CHATBOT_ERROR_SOURCES.AVAILABILITY
            ? retryAvailability
            : undefined
      }
      onModelChange={() => undefined}
      onNewConversation={startNewConversation}
      onOpenAccountSettings={onOpenAccountSettings}
      onRetryAvailability={retryAvailability}
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
  onOpenAccountSettings,
  onSelectedModelChange,
  returnFocusRef,
  selectedModel,
}: {
  draft: string;
  isOpen: boolean;
  onClose: () => void;
  onDraftChange: (draft: string) => void;
  onOpenAccountSettings: (anchor: AccountPageAnchor) => void;
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
      <DialogContent
        aria-modal="true"
        aria-describedby="flyt-chatbot-mobile-description"
        aria-labelledby="flyt-chatbot-mobile-title"
        id="flyt-chatbot-mobile"
        mobileOnly
        padding="none"
        showClose={false}
        variant="fullscreen"
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
        <DialogTitle visuallyHidden id="flyt-chatbot-mobile-title">
          Ask Flyt
        </DialogTitle>
        <DialogDescription id="flyt-chatbot-mobile-description" visuallyHidden>
          Ask questions about Norwegian and the current page.
        </DialogDescription>
        <ConnectedChatbotPanel
          draft={draft}
          onClose={onClose}
          onDraftChange={onDraftChange}
          onOpenAccountSettings={onOpenAccountSettings}
          onSelectedModelChange={onSelectedModelChange}
          selectedModel={selectedModel}
        />
      </DialogContent>
    </Dialog>
  );
}
