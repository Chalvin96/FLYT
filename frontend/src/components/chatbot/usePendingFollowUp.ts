import { useCallback, useLayoutEffect, useRef } from 'react';

import type { FlytChatbotMessage } from './types';

interface PendingFollowUp {
  messageCount: number;
  error: string | null;
}

interface UsePendingFollowUpOptions {
  draft: string;
  error: string | null;
  isLoading: boolean;
  lastMessage: FlytChatbotMessage | undefined;
  messages: readonly FlytChatbotMessage[];
  scrollToEnd: (options: { behavior: ScrollBehavior }) => void;
}

export function usePendingFollowUp({
  draft,
  error,
  isLoading,
  lastMessage,
  messages,
  scrollToEnd,
}: UsePendingFollowUpOptions) {
  const pendingFollowRef = useRef<PendingFollowUp | null>(null);

  useLayoutEffect(() => {
    const pendingFollow = pendingFollowRef.current;
    if (!pendingFollow) return;

    scrollToEnd({ behavior: 'auto' });

    const hasNewError = Boolean(error && error !== pendingFollow.error);
    const hasCompletedNewAnswer =
      messages.length > pendingFollow.messageCount &&
      !isLoading &&
      lastMessage?.role === 'chatbot';
    if (hasNewError || hasCompletedNewAnswer) {
      pendingFollowRef.current = null;
    }
  }, [draft, error, isLoading, lastMessage?.role, messages, scrollToEnd]);

  const markSendPending = useCallback(() => {
    pendingFollowRef.current = {
      error,
      messageCount: messages.length,
    };
  }, [error, messages.length]);

  const clearPendingFollow = useCallback(() => {
    pendingFollowRef.current = null;
  }, []);

  return { clearPendingFollow, markSendPending };
}
