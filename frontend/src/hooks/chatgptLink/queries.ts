import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

import {
  deleteChatGPTLink,
  getChatGPTLink,
  pollChatGPTLink,
  startChatGPTLink,
} from '@/api/chatgptLink';

export const chatGPTLinkKeys = {
  state: ['chatgpt-link'] as const,
};

export function getChatGPTLinkErrorCode(error: unknown): string | null {
  if (!isAxiosError(error)) return null;
  const detail = error.response?.data?.detail;
  return typeof detail?.code === 'string' ? detail.code : null;
}

export function useChatGPTLink() {
  return useQuery({
    queryKey: chatGPTLinkKeys.state,
    queryFn: getChatGPTLink,
  });
}

export function useStartChatGPTLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: startChatGPTLink,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chatGPTLinkKeys.state });
    },
  });
}

export function usePollChatGPTLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: pollChatGPTLink,
    onSuccess: (result) => {
      if (result.status === 'linked') {
        void queryClient.invalidateQueries({ queryKey: chatGPTLinkKeys.state });
      }
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: chatGPTLinkKeys.state });
    },
  });
}

export function useDeleteChatGPTLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteChatGPTLink,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chatGPTLinkKeys.state });
    },
  });
}
