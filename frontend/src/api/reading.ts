import type {
  ReadingHomeResponse,
  ReadingStoryListResponse,
  ReadingStoryPageResponse,
  ReadingStoryRecommendationsResponse,
} from '@/types/api';

import { client } from './client';

interface GetReadingStoriesOptions {
  limit?: number;
  cursor?: string | null;
  levels?: string[];
  showReadStories?: boolean;
}

export async function getReadingHome(): Promise<ReadingHomeResponse> {
  return (await client.get<ReadingHomeResponse>('/reading/home')).data;
}

export async function getReadingStories(
  groupKey: string,
  options: GetReadingStoriesOptions = {},
): Promise<ReadingStoryListResponse> {
  const { cursor, levels, limit, showReadStories } = options;

  return (
    await client.get<ReadingStoryListResponse>('/reading/stories', {
      params: {
        group_key: groupKey,
        limit,
        cursor,
        levels: levels && levels.length > 0 ? levels.join(',') : undefined,
        show_read: showReadStories,
      },
    })
  ).data;
}

export async function getReadingStory(
  uuid: string,
  page?: number,
): Promise<ReadingStoryPageResponse> {
  return (
    await client.get<ReadingStoryPageResponse>(`/reading/stories/${uuid}`, {
      params: { page },
    })
  ).data;
}

export async function getReadingStoryRecommendations(
  uuid: string,
): Promise<ReadingStoryRecommendationsResponse> {
  return (
    await client.get<ReadingStoryRecommendationsResponse>(
      `/reading/stories/${uuid}/recommendations`,
    )
  ).data;
}

export async function saveReadingProgress(
  uuid: string,
  pageIndex: number,
): Promise<void> {
  await client.post(`/reading/stories/${uuid}/progress`, { pageIndex });
}
