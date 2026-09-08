import { type QueryClient } from '@tanstack/react-query';
import { redirect } from '@tanstack/react-router';
import { isAxiosError } from 'axios';

import { meQueryOptions } from '@/hooks/auth/queries';

export async function requireShellAuth(
  queryClient: Pick<QueryClient, 'ensureQueryData'>,
) {
  try {
    await queryClient.ensureQueryData(meQueryOptions);
  } catch (error) {
    const status = isAxiosError(error) ? error.response?.status : undefined;

    if (status === 401 || status === 403) {
      throw redirect({ to: '/login' });
    }

    throw error;
  }
}
