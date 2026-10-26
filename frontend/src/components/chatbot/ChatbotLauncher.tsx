import { useRef } from 'react';
import type { RefObject } from 'react';

import { useChatbotOpenState } from './useChatbotOpenState';

export interface ChatbotLauncherState {
  chatbotOpen: boolean;
  chatbotTriggerRef: RefObject<HTMLButtonElement | null>;
  toggleChatbot: () => void;
}

export function useChatbotLauncher(): ChatbotLauncherState {
  const chatbotTriggerRef = useRef<HTMLButtonElement>(null);
  const { isOpen, toggle } = useChatbotOpenState();

  return {
    chatbotOpen: isOpen,
    chatbotTriggerRef,
    toggleChatbot: toggle,
  };
}
