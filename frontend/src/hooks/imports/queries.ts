import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';

import {
  createPasteImport,
  deleteImport,
  listImports,
  retryImport,
} from '@/api/imports';
import { getApiErrorCode } from '@/lib/apiError';
import { showApiError } from '@/lib/errors';
import {
  IMPORT_ERROR_CODES,
  type ImportItem,
  type ImportListResponse,
  type ImportStatusFilter,
  type PasteImportCreate,
} from '@/types/api';

export const importKeys = {
  lists: () => ['imports', 'list'] as const,
  list: (params: { status?: string; q?: string; limit?: number }) =>
    [
      'imports',
      'list',
      params.status ?? 'all',
      params.q ?? '',
      params.limit ?? 'server-default',
    ] as const,
};

function prependToList(
  cached: ImportListResponse | undefined,
  item: ImportItem,
): ImportListResponse | undefined {
  if (!cached) return cached;
  return { ...cached, items: [item, ...(cached.items ?? [])] };
}

function removeFromList(
  cached: ImportListResponse | undefined,
  itemId: string,
): ImportListResponse | undefined {
  if (!cached) return cached;
  return {
    ...cached,
    items: (cached.items ?? []).filter((it) => it.id !== itemId),
  };
}

function replaceItemInList(
  cached: ImportListResponse | undefined,
  itemId: string,
  newItem: ImportItem,
): ImportListResponse | undefined {
  if (!cached) return cached;
  const items = cached.items ?? [];
  if (!items.some((it) => it.id === itemId)) return cached;
  return {
    ...cached,
    items: items.map((it) => (it.id === itemId ? newItem : it)),
  };
}

function snapshotListCaches(
  queryClient: QueryClient,
): Array<[QueryKey, ImportListResponse | undefined]> {
  return queryClient.getQueriesData<ImportListResponse>({
    queryKey: importKeys.lists(),
  });
}

function restoreListCaches(
  queryClient: QueryClient,
  snapshots: Array<[QueryKey, ImportListResponse | undefined]>,
): void {
  snapshots.forEach(([queryKey, previous]) => {
    queryClient.setQueryData(queryKey, previous);
  });
}

function updateListCaches(
  queryClient: QueryClient,
  mutate: (
    cached: ImportListResponse | undefined,
  ) => ImportListResponse | undefined,
): void {
  for (const [queryKey, cached] of snapshotListCaches(queryClient)) {
    queryClient.setQueryData(queryKey, mutate(cached));
  }
}

export interface UseImportsParams {
  status?: ImportStatusFilter;
  q?: string;
  limit?: number;
}

export function useImports(params: UseImportsParams) {
  // No client-side default; the server owns the page-size bound.
  const listParams = {
    status: params.status,
    q: params.q,
    limit: params.limit,
  };
  return useQuery({
    queryKey: importKeys.list(listParams),
    queryFn: () => listImports(listParams),
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      const hasActive = items.some(
        (item) => item.status === 'pending' || item.status === 'processing',
      );
      return hasActive ? 4000 : false;
    },
  });
}

function buildOptimisticItem(payload: PasteImportCreate): ImportItem {
  return {
    id: `optimistic:${crypto.randomUUID()}`,
    storyUuid: 'optimistic',
    title: payload.title?.trim() || 'Importing…',
    sourceUrl: null,
    status: 'pending',
    errorCode: null,
    errorMessage: null,
    pageCount: null,
    wordCount: 0,
    createdAt: new Date().toISOString(),
  };
}

function getStatusFilter(queryKey: QueryKey): string | undefined {
  if (queryKey.length >= 4 && typeof queryKey[2] === 'string') {
    const raw = queryKey[2];
    return raw === 'all' ? undefined : raw;
  }
  return undefined;
}

function getSearchFilter(queryKey: QueryKey): string | undefined {
  if (queryKey.length >= 4 && typeof queryKey[3] === 'string') {
    return queryKey[3];
  }
  return undefined;
}

function listAcceptsPending(
  status: string | undefined,
  q: string | undefined,
): boolean {
  const acceptsStatus =
    status === undefined || status === 'pending' || status === 'processing';
  const hasSearch = typeof q === 'string' && q.length > 0;
  return acceptsStatus && !hasSearch;
}

function prependOptimisticItem(
  queryClient: QueryClient,
  item: ImportItem,
): Array<[QueryKey, ImportListResponse | undefined]> {
  const affected: Array<[QueryKey, ImportListResponse | undefined]> = [];
  for (const [queryKey, cached] of snapshotListCaches(queryClient)) {
    if (
      !listAcceptsPending(getStatusFilter(queryKey), getSearchFilter(queryKey))
    )
      continue;
    const next = prependToList(cached, item);
    if (next !== cached) {
      queryClient.setQueryData(queryKey, next);
      affected.push([queryKey, cached]);
    }
  }
  return affected;
}

interface OptimisticContext {
  snapshots: Array<[QueryKey, ImportListResponse | undefined]>;
  optimistic: ImportItem;
}

export function useCreatePasteImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: PasteImportCreate) => createPasteImport(payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: importKeys.lists() });
      const optimistic = buildOptimisticItem(payload);
      const snapshots = prependOptimisticItem(queryClient, optimistic);
      return { optimistic, snapshots } satisfies OptimisticContext;
    },
    onSuccess: async (data, _payload, context) => {
      if (context?.optimistic) {
        updateListCaches(queryClient, (cached) =>
          replaceItemInList(cached, context.optimistic.id, data),
        );
      }
      await queryClient.invalidateQueries({ queryKey: importKeys.lists() });
    },
    onError: (error, _payload, context) => {
      if (context) restoreListCaches(queryClient, context.snapshots);
      if (context?.optimistic) {
        updateListCaches(queryClient, (cached) =>
          removeFromList(cached, context.optimistic.id),
        );
      }
      void queryClient.invalidateQueries({ queryKey: importKeys.lists() });

      if (getApiErrorCode(error) !== IMPORT_ERROR_CODES.QUOTA_EXCEEDED) {
        showApiError(error);
      }
    },
  });
}

interface DeleteContext {
  snapshots: Array<[QueryKey, ImportListResponse | undefined]>;
}

export function useDeleteImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (importId: string) => deleteImport(importId),
    onMutate: async (importId) => {
      await queryClient.cancelQueries({ queryKey: importKeys.lists() });

      const snapshots = snapshotListCaches(queryClient);

      for (const [queryKey, cached] of snapshots) {
        queryClient.setQueryData(queryKey, removeFromList(cached, importId));
      }

      return { snapshots } satisfies DeleteContext;
    },
    onError: (error, _importId, context) => {
      restoreListCaches(queryClient, context?.snapshots ?? []);
      showApiError(error);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: importKeys.lists() });
    },
  });
}

interface RetryContext {
  snapshots: Array<[QueryKey, ImportListResponse | undefined]>;
}

export function useRetryImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (importId: string) => retryImport(importId),
    onMutate: async (importId) => {
      await queryClient.cancelQueries({ queryKey: importKeys.lists() });

      const snapshots = snapshotListCaches(queryClient);

      for (const [queryKey, cached] of snapshots) {
        const existing = cached?.items?.find((it) => it.id === importId);
        if (!existing) continue;
        const pendingItem: ImportItem = {
          ...existing,
          status: 'pending',
          errorCode: null,
          errorMessage: null,
        };
        queryClient.setQueryData(
          queryKey,
          replaceItemInList(cached, importId, pendingItem),
        );
      }

      return { snapshots } satisfies RetryContext;
    },
    onError: (error, _importId, context) => {
      restoreListCaches(queryClient, context?.snapshots ?? []);
      showApiError(error);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: importKeys.lists() });
    },
  });
}
