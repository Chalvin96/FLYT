import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requireShellAuth } from '@/components/routing/requireShellAuth';

const mockEnsureQueryData = vi.fn();
const mockRedirect = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({}),
  redirect: (options: unknown) => mockRedirect(options),
}));

vi.mock('@/api/auth', () => ({
  getMe: vi.fn(),
}));

vi.mock('@/hooks/auth/queries', () => ({
  meQueryOptions: { queryKey: ['me'], queryFn: vi.fn() },
}));

describe('requireShellAuth', () => {
  beforeEach(() => {
    mockEnsureQueryData.mockReset();
    mockRedirect.mockReset();
    mockRedirect.mockImplementation((options) => options);
  });

  it('loads the current user before entering the app shell', async () => {
    mockEnsureQueryData.mockResolvedValue({ id: 1 });

    await requireShellAuth({ ensureQueryData: mockEnsureQueryData });

    expect(mockEnsureQueryData).toHaveBeenCalledOnce();
  });

  it('redirects unauthenticated users to login', async () => {
    mockEnsureQueryData.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401 },
    });

    await expect(
      requireShellAuth({ ensureQueryData: mockEnsureQueryData }),
    ).rejects.toEqual({ to: '/login' });

    expect(mockRedirect).toHaveBeenCalledWith({ to: '/login' });
  });

  it('redirects forbidden users to login', async () => {
    mockEnsureQueryData.mockRejectedValue({
      isAxiosError: true,
      response: { status: 403 },
    });

    await expect(
      requireShellAuth({ ensureQueryData: mockEnsureQueryData }),
    ).rejects.toEqual({ to: '/login' });

    expect(mockRedirect).toHaveBeenCalledWith({ to: '/login' });
  });

  it('rethrows non-auth failures', async () => {
    const error = new Error('boom');
    mockEnsureQueryData.mockRejectedValue(error);

    await expect(
      requireShellAuth({ ensureQueryData: mockEnsureQueryData }),
    ).rejects.toBe(error);

    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
