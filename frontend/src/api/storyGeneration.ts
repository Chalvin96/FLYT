import type {
  ImportItem,
  StoryGenerationCreate,
  StoryGenerationCreateResponse,
  StoryGenerationCurrentResponse,
  StoryGenerationSurfaceResponse,
} from '@/types/api';

import { client } from './client';

export async function getStoryGenerationSurface(): Promise<StoryGenerationSurfaceResponse> {
  return (await client.get<StoryGenerationSurfaceResponse>('/story-generation'))
    .data;
}

export async function createStoryGeneration(
  payload: StoryGenerationCreate,
): Promise<StoryGenerationCreateResponse> {
  return (
    await client.post<StoryGenerationCreateResponse>(
      '/story-generation/generations',
      payload,
    )
  ).data;
}

export async function getCurrentStoryGeneration(): Promise<StoryGenerationCurrentResponse | null> {
  return (
    await client.get<StoryGenerationCurrentResponse | null>(
      '/story-generation/generations/current',
    )
  ).data;
}

export async function importCurrentStoryGeneration(
  title?: string,
): Promise<ImportItem> {
  return (
    await client.post<ImportItem>(
      '/story-generation/generations/current/import',
      {
        ...(title ? { title } : {}),
      },
    )
  ).data;
}
