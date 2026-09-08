import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { getMe, logout, updateMe } from '@/api/auth';
import type { UserUpdate } from '@/types/api';

export const authKeys = {
  me: ['me'] as const,
};

export const meQueryOptions = queryOptions({
  queryKey: authKeys.me,
  queryFn: getMe,
  retry: false,
});

export function useMe() {
  return useQuery(meQueryOptions);
}

export function useUpdateMe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UserUpdate) => updateMe(payload),
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me, user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
    },
  });

  return {
    isPending: mutation.isPending,
    logout: mutation.mutateAsync,
  };
}
