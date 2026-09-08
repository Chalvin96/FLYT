import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createStoryGeneration,
  getCurrentStoryGeneration,
  getStoryGenerationSurface,
  importCurrentStoryGeneration,
} from '@/api/storyGeneration';
import type { ImportItem, StoryGenerationCreate } from '@/types/api';

export const storyGenerationKeys = {
  surface: ['story-generation', 'surface'] as const,
  current: ['story-generation', 'current'] as const,
};

export const STORY_GENERATION_POLL_INTERVAL_MS = 1_000;

export function useStoryGenerationSurface() {
  return useQuery({
    queryKey: storyGenerationKeys.surface,
    queryFn: getStoryGenerationSurface,
  });
}

export function useCurrentStoryGeneration() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: storyGenerationKeys.current,
    queryFn: getCurrentStoryGeneration,
    refetchInterval: ({ state }) =>
      state.data?.status === 'processing'
        ? STORY_GENERATION_POLL_INTERVAL_MS
        : false,
  });

  const current = query.data;
  useEffect(() => {
    if (
      current?.status === 'ready' ||
      current?.status === 'failed' ||
      current?.status === 'refused'
    ) {
      void queryClient.invalidateQueries({
        queryKey: storyGenerationKeys.surface,
      });
    }
  }, [current?.generationId, current?.status, queryClient]);

  return query;
}

export function useCreateStoryGeneration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: StoryGenerationCreate) =>
      createStoryGeneration(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: storyGenerationKeys.surface,
        }),
        queryClient.invalidateQueries({
          queryKey: storyGenerationKeys.current,
        }),
      ]);
    },
    onError: () => {
      void queryClient.invalidateQueries({
        queryKey: storyGenerationKeys.surface,
      });
    },
  });
}

export function useImportCurrentStoryGeneration({
  onImported,
}: {
  onImported: (item: ImportItem) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title?: string) => importCurrentStoryGeneration(title),
    onSuccess: async (item) => {
      onImported(item);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: storyGenerationKeys.surface,
        }),
        queryClient.invalidateQueries({
          queryKey: storyGenerationKeys.current,
        }),
      ]);
    },
  });
}
