import type {
  ImportItem,
  ImportListResponse,
  ImportStatusFilter,
  ImportTitleUpdate,
  PasteImportCreate,
} from '@/types/api';

import { client } from './client';

export interface ListImportsOptions {
  status?: ImportStatusFilter;
  q?: string;
  limit?: number;
}

export async function listImports(
  options: ListImportsOptions = {},
): Promise<ImportListResponse> {
  return (
    await client.get<ImportListResponse>('/imports', {
      params: {
        status: options.status,
        q: options.q,
        limit: options.limit,
      },
    })
  ).data;
}

export async function createPasteImport(
  payload: PasteImportCreate,
): Promise<ImportItem> {
  return (await client.post<ImportItem>('/imports', payload)).data;
}

export async function retryImport(id: string): Promise<void> {
  await client.post(`/imports/${id}/retry`);
}

export async function renameImport({
  id,
  title,
}: ImportTitleUpdate & { id: string }): Promise<ImportItem> {
  return (await client.patch<ImportItem>(`/imports/${id}`, { title })).data;
}

export async function deleteImport(id: string): Promise<void> {
  await client.delete(`/imports/${id}`);
}
