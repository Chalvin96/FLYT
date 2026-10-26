import { useCallback } from 'react';

import { useIsDesktop } from '@/hooks/ui/useIsDesktop';

import { useChatbot, type ChatbotOpenState } from './ChatbotProvider';
import { CHATBOT_OPEN_STATES, type FlytChatbotContext } from './types';

export interface ChatbotResolvedOpenState {
  isDesktop: boolean;
  isRailOpen: boolean;
  isDialogOpen: boolean;
  isOpen: boolean;
  openState: ChatbotOpenState;
  open(): void;
  close(): void;
  toggle(): void;
}

/**
 * Resolves the provider's `auto | open | closed` intent for the current
 * viewport and records explicit desktop choices. The provider stays ignorant
 * of layout; the launcher and the layout share this resolution.
 */
export function useChatbotOpenState(): ChatbotResolvedOpenState {
  const isDesktop = useIsDesktop();
  const { close, open, openState, railOpenPreference, rememberRailOpen } =
    useChatbot();

  const isRailOpen =
    isDesktop &&
    (openState === CHATBOT_OPEN_STATES.OPEN ||
      (openState === CHATBOT_OPEN_STATES.AUTO && railOpenPreference === true));
  const isDialogOpen = !isDesktop && openState === CHATBOT_OPEN_STATES.OPEN;
  const isOpen = isRailOpen || isDialogOpen;

  const openChatbot = useCallback(
    (context?: FlytChatbotContext) => {
      open(context);
      if (isDesktop) rememberRailOpen(true);
    },
    [isDesktop, open, rememberRailOpen],
  );
  const closeChatbot = useCallback(() => {
    close();
    if (isDesktop) rememberRailOpen(false);
  }, [close, isDesktop, rememberRailOpen]);
  const toggle = useCallback(() => {
    if (isOpen) {
      closeChatbot();
    } else {
      openChatbot();
    }
  }, [closeChatbot, isOpen, openChatbot]);

  return {
    isDesktop,
    isRailOpen,
    isDialogOpen,
    isOpen,
    openState,
    open: openChatbot,
    close: closeChatbot,
    toggle,
  };
}
