import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useCreatePasteImport } from '@/hooks/imports/queries';
import {
  type ImportItem,
  type ImportListResponse,
  type PasteImportCreate,
} from '@/types/api';

const { createPasteImport, showApiError } = vi.hoisted(() => ({
  createPasteImport: vi.fn(),
  showApiError: vi.fn(),
}));

vi.mock('@/api/imports', () => ({
  createPasteImport,
}));

vi.mock('@/lib/errors', () => ({
  showApiError,
}));

function buildList(
  overrides: Partial<ImportListResponse> = {},
): ImportListResponse {
  return {
    items: [],
    nextCursor: null,
    quota: { used: 0, limit: 10 },
    ...overrides,
  };
}

function buildPendingItem(): ImportItem {
  return {
    id: 'server-1',
    storyUuid: 'story-1',
    title: 'Pasted',
    sourceUrl: null,
    status: 'pending',
    errorCode: null,
    errorMessage: null,
    pageCount: null,
    wordCount: 0,
    createdAt: '2026-07-20T10:00:00Z',
  };
}

function buildQuotaError() {
  return Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: {
      status: 429,
      data: {
        detail: {
          code: 'IMPORT_QUOTA_EXCEEDED',
          message: 'Import limit reached.',
        },
      },
    },
    config: {},
  });
}

function buildGenericError() {
  return Object.assign(new Error('Boom'), {
    isAxiosError: true,
    response: {
      status: 500,
      data: { detail: { code: 'INTERNAL', message: 'Boom' } },
    },
    config: {},
  });
}

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const PAYLOAD: PasteImportCreate = { text: 'En kort setning.' };

describe('useCreatePasteImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createPasteImport.mockResolvedValue(buildPendingItem());
  });

  it('test_optimistic_create_given_pending_list_cache_expect_optimistic_item_prepended', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    // Seed a list whose status filter is `processing` (server matches pending
    // AND processing for this filter — a pending row belongs here).
    const listKey = ['imports', 'list', 'processing', '', 20] as const;
    const seeded = buildList({ items: [] });
    queryClient.setQueryData(listKey, seeded);

    const { result } = renderHook(() => useCreatePasteImport(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync(PAYLOAD);
    });

    // After onSuccess the optimistic placeholder is replaced with the real
    // server-returned item (id 'server-1', title 'Pasted').
    const cached = queryClient.getQueryData<ImportListResponse>(listKey);
    expect(cached?.items[0]?.status).toBe('pending');
    expect(cached?.items[0]?.id).toBe('server-1');
  });

  it('test_optimistic_create_given_unfiltered_list_cache_expect_optimistic_item_prepended', async () => {
    // An unfiltered (`status === undefined`) list returns everything on the
    // server, so a pending row belongs in it too.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const listKey = ['imports', 'list', 'all', '', 20] as const;
    queryClient.setQueryData(listKey, buildList({ items: [] }));

    const { result } = renderHook(() => useCreatePasteImport(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync(PAYLOAD);
    });

    // After onSuccess the real server item replaces the optimistic
    // placeholder, so the cached item has the server id, not an optimistic id.
    const cached = queryClient.getQueryData<ImportListResponse>(listKey);
    expect(cached?.items.some((i) => i.id === 'server-1')).toBe(true);
    expect(cached?.items.some((i) => i.id.startsWith('optimistic:'))).toBe(
      false,
    );
  });

  it('test_optimistic_create_given_failed_status_list_cache_expect_no_optimistic_item_prepended', async () => {
    // The bug: the blanket `{ queryKey: ['imports'] }` predicate spliced the
    // optimistic pending card into EVERY cached list — including `failed` and
    // `ready`, which the server would never return as pending. A pending row
    // does NOT belong in a `failed`-filtered list.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const failedListKey = ['imports', 'list', 'failed', '', 20] as const;
    const readyListKey = ['imports', 'list', 'ready', '', 20] as const;
    const failedSeed = buildList({ items: [] });
    const readySeed = buildList({ items: [] });
    queryClient.setQueryData(failedListKey, failedSeed);
    queryClient.setQueryData(readyListKey, readySeed);

    const { result } = renderHook(() => useCreatePasteImport(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync(PAYLOAD);
    });

    const failedCache =
      queryClient.getQueryData<ImportListResponse>(failedListKey);
    const readyCache =
      queryClient.getQueryData<ImportListResponse>(readyListKey);
    expect(failedCache?.items.length).toBe(0);
    expect(readyCache?.items.length).toBe(0);
  });

  it('test_optimistic_create_given_detail_cache_expect_shape_unchanged', async () => {
    // The bug: a blanket `['imports']` predicate also matched detail caches,
    // which are a single `ImportItem` (not a list). Writing a list-shaped
    // optimistic value into a detail slot corrupted that cache.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const detailKey = ['imports', 'detail', 'server-1'] as const;
    const detailItem = buildPendingItem();
    queryClient.setQueryData(detailKey, detailItem);

    const { result } = renderHook(() => useCreatePasteImport(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync(PAYLOAD);
    });

    const cachedDetail = queryClient.getQueryData<ImportItem>(detailKey);
    expect(cachedDetail).toEqual(detailItem);
  });

  it('test_optimistic_create_given_failed_create_expect_cache_rolled_back_to_snapshot', async () => {
    // The bug: `onError` only invalidated; if the invalidate refetch also
    // failed (offline / backend down) the optimistic ghost card persisted
    // forever. Snapshot rollback restores the exact prior cache regardless.
    createPasteImport.mockRejectedValueOnce(buildGenericError());

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const listKey = ['imports', 'list', 'processing', '', 20] as const;
    const priorItem: ImportItem = {
      id: 'pre-existing',
      storyUuid: 'pre-story',
      title: 'Pre',
      sourceUrl: null,
      status: 'processing',
      errorCode: null,
      errorMessage: null,
      pageCount: null,
      wordCount: 10,
      createdAt: '2026-07-20T09:00:00Z',
    };
    const prior = buildList({ items: [priorItem] });
    queryClient.setQueryData(listKey, prior);

    const { result } = renderHook(() => useCreatePasteImport(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await expect(result.current.mutateAsync(PAYLOAD)).rejects.toThrow();
    });

    // The snapshot must be restored: the cache is exactly what it was before
    // the mutation, NOT a ghost optimistic card.
    const cached = queryClient.getQueryData<ImportListResponse>(listKey);
    expect(cached?.items.length).toBe(1);
    expect(cached?.items[0]?.id).toBe('pre-existing');
  });

  it('test_optimistic_create_given_quota_exceeded_error_expect_show_api_error_skipped', async () => {
    // The bug: the hook called `showApiError` unconditionally, so a 429 showed
    // BOTH the generic toast here AND the paste sheet's quota dialog —
    // contradictory messages. The sheet owns the 429 surface now.
    createPasteImport.mockRejectedValueOnce(buildQuotaError());

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useCreatePasteImport(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await expect(result.current.mutateAsync(PAYLOAD)).rejects.toThrow();
    });

    expect(showApiError).not.toHaveBeenCalled();
  });

  it('test_optimistic_create_given_non_quota_error_expect_show_api_error_called', async () => {
    // Non-quota errors still surface a generic toast (the hook only suppresses
    // 429 IMPORT_QUOTA_EXCEEDED; everything else is unexpected).
    createPasteImport.mockRejectedValueOnce(buildGenericError());

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useCreatePasteImport(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await expect(result.current.mutateAsync(PAYLOAD)).rejects.toThrow();
    });

    await waitFor(() => {
      expect(showApiError).toHaveBeenCalledTimes(1);
    });
  });
});
