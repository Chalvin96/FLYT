import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  completeLesson,
  completeLessonExercise,
  getLesson,
  listLessons,
  startLesson,
} from '@/api/lessons';
import { showApiError } from '@/lib/errors';
import type { LessonProgressRead } from '@/types/api';

export const lessonKeys = {
  all: ['lessons'] as const,
  lists: () => ['lessons', 'list'] as const,
  detail: (lessonId: number) => ['lesson', lessonId] as const,
  progress: (lessonId: number) => ['lesson', lessonId, 'progress'] as const,
};

export function useLessons() {
  return useQuery({
    queryKey: lessonKeys.lists(),
    queryFn: listLessons,
  });
}

export function useLesson(lessonId: number) {
  return useQuery({
    queryKey: lessonKeys.detail(lessonId),
    queryFn: () => getLesson(lessonId),
    enabled: Number.isFinite(lessonId),
  });
}

export function useStartLesson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lessonId: number) => startLesson(lessonId),
    onSuccess: (_data, lessonId) => {
      void queryClient.invalidateQueries({ queryKey: lessonKeys.all });
      void queryClient.invalidateQueries({
        queryKey: lessonKeys.detail(lessonId),
      });
    },
    onError: showApiError,
  });
}

export function useCompleteLessonExercise(lessonId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (exerciseId: string) =>
      completeLessonExercise(lessonId, exerciseId),
    onSuccess: (progress: LessonProgressRead) => {
      queryClient.setQueryData<LessonProgressRead>(
        lessonKeys.progress(lessonId),
        progress,
      );
      void queryClient.invalidateQueries({ queryKey: lessonKeys.lists() });
      void queryClient.invalidateQueries({
        queryKey: lessonKeys.detail(lessonId),
      });
    },
    onError: showApiError,
  });
}

export function useCompleteLesson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lessonId: number) => completeLesson(lessonId),
    onSuccess: (_data, lessonId) => {
      void queryClient.invalidateQueries({ queryKey: lessonKeys.all });
      void queryClient.invalidateQueries({
        queryKey: lessonKeys.detail(lessonId),
      });
    },
    onError: showApiError,
  });
}
