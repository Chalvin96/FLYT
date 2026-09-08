import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { type ReactNode } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  type QueryKey,
} from '@tanstack/react-query';

import {
  importKeys,
  useCreatePasteImport,
  useDeleteImport,
  useImports,
  useRetryImport,
} from '@/hooks/imports/queries';
import { buildImportItem, buildImportList } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { type ImportListResponse } from '@/types/api';

vi.mock('@/lib/errors', () => ({ showApiError: vi.fn() }));

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// Holds a response in flight so a test can observe the optimistic cache.
function gate() {
  let release!: () => void;
  const opened = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { opened, release };
}

function itemIds(queryClient: QueryClient, key: QueryKey) {
  return queryClient
    .getQueryData<ImportListResponse>(key)
    ?.items.map((item) => item.id);
}

function newQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

describe('imports hooks over a real request', () => {
  it('test_use_imports_given_no_limit_expect_no_limit_param_on_the_wire', async () => {
    // A reappearing client-side default shows up here as a query param.
    let requestUrl: URL | undefined;
    server.use(
      http.get('*/imports', ({ request }) => {
        requestUrl = new URL(request.url);
        return HttpResponse.json(buildImportList());
      }),
    );

    const { result } = renderHook(() => useImports({}), {
      wrapper: wrapper(newQueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestUrl?.searchParams.has('limit')).toBe(false);
  });

  it('test_use_imports_given_status_and_query_expect_filters_serialized_as_params', async () => {
    let requestUrl: URL | undefined;
    server.use(
      http.get('*/imports', ({ request }) => {
        requestUrl = new URL(request.url);
        return HttpResponse.json(buildImportList());
      }),
    );

    const { result } = renderHook(
      () => useImports({ status: 'failed', q: 'klima', limit: 6 }),
      { wrapper: wrapper(newQueryClient()) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestUrl?.searchParams.get('status')).toBe('failed');
    expect(requestUrl?.searchParams.get('q')).toBe('klima');
    expect(requestUrl?.searchParams.get('limit')).toBe('6');
  });

  it('test_create_paste_import_given_server_error_expect_optimistic_item_rolled_back', async () => {
    // Observe the optimistic insert before the failure, or the assertion also
    // passes when onMutate never touched the cache.
    const response = gate();
    server.use(
      http.post('*/imports', async () => {
        await response.opened;
        return HttpResponse.json(
          { detail: { code: 'IMPORT_EMPTY', message: 'Empty' } },
          { status: 422 },
        );
      }),
    );

    const queryClient = newQueryClient();
    const listKey = importKeys.list({});
    const before = buildImportList([buildImportItem({ id: 'existing-1' })]);
    queryClient.setQueryData<ImportListResponse>(listKey, before);

    const { result } = renderHook(() => useCreatePasteImport(), {
      wrapper: wrapper(queryClient),
    });

    const pending = result.current.mutateAsync({ text: 'noe tekst' });

    await waitFor(() => expect(itemIds(queryClient, listKey)).toHaveLength(2));

    response.release();
    await expect(pending).rejects.toThrow();

    await waitFor(() => {
      expect(queryClient.getQueryData<ImportListResponse>(listKey)).toEqual(
        before,
      );
    });
  });

  it('test_create_paste_import_given_success_expect_optimistic_item_replaced_by_server_item', async () => {
    server.use(
      http.post('*/imports', () =>
        HttpResponse.json(
          buildImportItem({ id: 'server-1', status: 'pending' }),
          { status: 201 },
        ),
      ),
      http.get('*/imports', () =>
        HttpResponse.json(
          buildImportList([buildImportItem({ id: 'server-1' })]),
        ),
      ),
    );

    const queryClient = newQueryClient();
    const listKey = importKeys.list({});
    queryClient.setQueryData<ImportListResponse>(listKey, buildImportList([]));

    const { result } = renderHook(() => useCreatePasteImport(), {
      wrapper: wrapper(queryClient),
    });

    await result.current.mutateAsync({ text: 'noe tekst' });

    await waitFor(() => {
      const cached = queryClient.getQueryData<ImportListResponse>(listKey);
      expect(cached?.items.map((item) => item.id)).toEqual(['server-1']);
    });
  });

  it('test_retry_import_given_success_expect_item_flipped_to_pending', async () => {
    server.use(
      http.post(
        '*/imports/:id/retry',
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    const queryClient = newQueryClient();
    const listKey = importKeys.list({});
    queryClient.setQueryData<ImportListResponse>(
      listKey,
      buildImportList([
        buildImportItem({
          id: 'failed-1',
          status: 'failed',
          errorCode: 'IMPORT_FETCH_FAILED',
          errorMessage: 'Could not fetch',
        }),
      ]),
    );

    const { result } = renderHook(() => useRetryImport(), {
      wrapper: wrapper(queryClient),
    });

    await result.current.mutateAsync('failed-1');

    const cached = queryClient.getQueryData<ImportListResponse>(listKey);
    expect(cached?.items[0]).toMatchObject({
      status: 'pending',
      errorCode: null,
      errorMessage: null,
    });
  });

  it('test_retry_import_given_server_error_expect_failed_item_restored', async () => {
    const response = gate();
    server.use(
      http.post('*/imports/:id/retry', async () => {
        await response.opened;
        return HttpResponse.json(
          { detail: { code: 'IMPORT_NOT_FOUND', message: 'Gone' } },
          { status: 404 },
        );
      }),
    );

    const queryClient = newQueryClient();
    const listKey = importKeys.list({});
    const before = buildImportList([
      buildImportItem({
        id: 'failed-1',
        status: 'failed',
        errorCode: 'IMPORT_FETCH_FAILED',
        errorMessage: 'Could not fetch',
      }),
    ]);
    queryClient.setQueryData<ImportListResponse>(listKey, before);

    const { result } = renderHook(() => useRetryImport(), {
      wrapper: wrapper(queryClient),
    });

    const pending = result.current.mutateAsync('failed-1');

    await waitFor(() => {
      expect(
        queryClient.getQueryData<ImportListResponse>(listKey)?.items[0],
      ).toMatchObject({ status: 'pending', errorCode: null });
    });

    response.release();
    await expect(pending).rejects.toThrow();

    await waitFor(() => {
      expect(queryClient.getQueryData<ImportListResponse>(listKey)).toEqual(
        before,
      );
    });
  });

  it('test_delete_import_given_success_expect_item_removed_from_list', async () => {
    server.use(
      http.delete(
        '*/imports/:id',
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    const queryClient = newQueryClient();
    const listKey = importKeys.list({});
    queryClient.setQueryData<ImportListResponse>(
      listKey,
      buildImportList([
        buildImportItem({ id: 'keep-1' }),
        buildImportItem({ id: 'drop-1' }),
      ]),
    );

    const { result } = renderHook(() => useDeleteImport(), {
      wrapper: wrapper(queryClient),
    });

    await result.current.mutateAsync('drop-1');

    const cached = queryClient.getQueryData<ImportListResponse>(listKey);
    expect(cached?.items.map((item) => item.id)).toEqual(['keep-1']);
  });

  it('test_delete_import_given_server_error_expect_removed_item_restored', async () => {
    const response = gate();
    server.use(
      http.delete('*/imports/:id', async () => {
        await response.opened;
        return HttpResponse.json(
          { detail: { code: 'IMPORT_NOT_FOUND', message: 'Gone' } },
          { status: 404 },
        );
      }),
    );

    const queryClient = newQueryClient();
    const listKey = importKeys.list({});
    const before = buildImportList([
      buildImportItem({ id: 'keep-1' }),
      buildImportItem({ id: 'drop-1' }),
    ]);
    queryClient.setQueryData<ImportListResponse>(listKey, before);

    const { result } = renderHook(() => useDeleteImport(), {
      wrapper: wrapper(queryClient),
    });

    const pending = result.current.mutateAsync('drop-1');

    await waitFor(() => {
      expect(itemIds(queryClient, listKey)).toEqual(['keep-1']);
    });

    response.release();
    await expect(pending).rejects.toThrow();

    await waitFor(() => {
      expect(queryClient.getQueryData<ImportListResponse>(listKey)).toEqual(
        before,
      );
    });
  });
});
