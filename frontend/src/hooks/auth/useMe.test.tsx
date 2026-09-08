import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { getMe, updateMe } from '@/api/auth';
import { useMe, useUpdateMe } from '@/hooks/auth/queries';

vi.mock('@/api/auth', () => ({
  getMe: vi.fn(),
  logout: vi.fn(),
  googleStartUrl: vi.fn(),
  updateMe: vi.fn(),
}));

describe('useMe', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads and caches authenticated user profile', async () => {
    const user = {
      id: 1,
      uuid: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@example.com',
      display_name: 'Test User',
      avatar_url: null,
      last_login: null,
    };
    vi.mocked(getMe).mockResolvedValueOnce(user);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useMe(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(getMe).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(['me'])).toEqual(user);
  });

  it('returns an error state for unauthenticated requests', async () => {
    vi.mocked(getMe).mockRejectedValueOnce(new Error('Unauthorized'));

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useMe(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(getMe).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(['me'])).toBeUndefined();
  });

  it('updates cached user profile after saving display name', async () => {
    const user = {
      id: 1,
      uuid: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@example.com',
      display_name: 'New Name',
      avatar_url: null,
      last_login: null,
    };
    vi.mocked(updateMe).mockResolvedValueOnce(user);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUpdateMe(), { wrapper });

    result.current.mutate({ display_name: 'New Name' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(updateMe).toHaveBeenCalledWith({ display_name: 'New Name' });
    expect(queryClient.getQueryData(['me'])).toEqual(user);
  });
});
