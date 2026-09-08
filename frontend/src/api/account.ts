import type { DeletionPreviewRead } from '@/types/api';

import { client } from './client';

export async function getDeletionPreview(): Promise<DeletionPreviewRead> {
  return (await client.get<DeletionPreviewRead>('/users/me/deletion-preview'))
    .data;
}

export async function deleteAccount(): Promise<void> {
  await client.delete('/users/me');
}
