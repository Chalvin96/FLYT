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

type ChatbotAccountId = string | number | null | undefined;

export const chatbotKeys = {
  surface: (accountId: ChatbotAccountId) =>
    ['chatbot', 'surface', accountId ?? null] as const,
};

export function getChatbotErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const message = error.response?.data?.detail?.message;
    if (typeof message === 'string') return message;
  }
  return 'The chatbot could not answer. Try again in a moment.';
}

export function useChatbotSurface(accountId: ChatbotAccountId = null) {
  return useQuery<ChatbotSurface>({
    queryKey: chatbotKeys.surface(accountId),
    queryFn: getChatbotSurface,
    retry: false,
    staleTime: 30_000,
  });
}

export function useSendChatbotMessage(accountId: ChatbotAccountId = null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ChatbotMessageRequest) => sendChatbotMessage(payload),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: chatbotKeys.surface(accountId),
      });
    },
  });
}

export function useReplaceOpenRouterKey(accountId: ChatbotAccountId = null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: replaceOpenRouterKey,
    onSuccess: (status) => {
      queryClient.setQueryData<ChatbotSurface>(
        chatbotKeys.surface(accountId),
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
      void queryClient.invalidateQueries({
        queryKey: chatbotKeys.surface(accountId),
      });
    },
  });
}

export function useDeleteOpenRouterKey(accountId: ChatbotAccountId = null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteOpenRouterKey,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: chatbotKeys.surface(accountId),
      });
    },
  });
}
