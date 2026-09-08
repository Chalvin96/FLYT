import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { deleteAccount, getDeletionPreview } from '@/api/account';

export const accountKeys = {
  deletionPreview: ['account-deletion-preview'] as const,
};

export function useDeleteAccount(onDeleted: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      onDeleted();
      queryClient.clear();
    },
  });
}

export function useDeletionPreview(enabled: boolean) {
  return useQuery({
    queryKey: accountKeys.deletionPreview,
    queryFn: getDeletionPreview,
    enabled,
    retry: false,
    gcTime: 0,
  });
}
