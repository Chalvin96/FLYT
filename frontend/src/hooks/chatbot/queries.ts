import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

import {
  deleteOpenRouterKey,
  getChatbotSurface,
  replaceOpenRouterKey,
  sendChatbotMessage,
  type ChatbotMessageRequest,
  type ChatbotSurface,
} from '@/api/chatbot';

export const chatbotKeys = {
  surface: ['chatbot', 'surface'] as const,
};

export function getChatbotErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const message = error.response?.data?.detail?.message;
    if (typeof message === 'string') return message;
  }
  return 'The chatbot could not answer. Try again in a moment.';
}

export function useChatbotSurface() {
  return useQuery<ChatbotSurface>({
    queryKey: chatbotKeys.surface,
    queryFn: getChatbotSurface,
    staleTime: 30_000,
  });
}

export function useSendChatbotMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ChatbotMessageRequest) => sendChatbotMessage(payload),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: chatbotKeys.surface });
    },
  });
}

export function useReplaceOpenRouterKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: replaceOpenRouterKey,
    onSuccess: (status) => {
      queryClient.setQueryData<ChatbotSurface>(
        chatbotKeys.surface,
        (surface) =>
          surface
            ? {
                ...surface,
                openrouterKeyConfigured: status.openrouterKeyConfigured,
                models: surface.models.map((model) =>
                  model.requiresOpenRouterKey
                    ? { ...model, available: true, reason: null, action: null }
                    : model,
                ),
              }
            : surface,
      );
      void queryClient.invalidateQueries({ queryKey: chatbotKeys.surface });
    },
  });
}

export function useDeleteOpenRouterKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteOpenRouterKey,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chatbotKeys.surface });
    },
  });
}
