import { useRef } from 'react';
import type { RefObject } from 'react';

import { useIsDesktop } from '@/hooks/ui/useIsDesktop';

import { useChatbot } from './ChatbotProvider';

export interface ChatbotLauncherState {
  chatbotOpen: boolean;
  chatbotTriggerRef: RefObject<HTMLButtonElement | null>;
  toggleChatbot: () => void;
}

export function useChatbotLauncher(): ChatbotLauncherState {
  const chatbotTriggerRef = useRef<HTMLButtonElement>(null);
  const isDesktop = useIsDesktop();
  const { close, open, openState } = useChatbot();
  const chatbotOpen = isDesktop ? openState !== 'closed' : openState === 'open';

  const toggleChatbot = () => {
    if (chatbotOpen) {
      close();
    } else {
      open();
    }
  };

  return { chatbotOpen, chatbotTriggerRef, toggleChatbot };
}
