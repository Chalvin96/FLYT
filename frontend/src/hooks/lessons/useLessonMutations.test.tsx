import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { completeLessonExercise, startLesson } from '@/api/lessons';
import {
  lessonKeys,
  useCompleteLessonExercise,
  useStartLesson,
} from '@/hooks/lessons/queries';

vi.mock('@/api/lessons', () => ({
  completeLessonExercise: vi.fn(),
  startLesson: vi.fn(),
}));

vi.mock('@/lib/errors', () => ({
  showApiError: vi.fn(),
}));

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('lesson mutations', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('test_start_lesson_given_success_expect_list_and_detail_caches_invalidated', async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(startLesson).mockResolvedValue({
      completed_exercise_ids: [],
      completed_at: null,
    });

    const { result } = renderHook(() => useStartLesson(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync(42);
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: lessonKeys.all,
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: lessonKeys.detail(42),
    });
  });

  it('test_complete_lesson_exercise_given_success_expect_list_and_detail_caches_invalidated', async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const progress = {
      completed_exercise_ids: ['exercise-1'],
      completed_at: null,
    };
    vi.mocked(completeLessonExercise).mockResolvedValue(progress);

    const { result } = renderHook(() => useCompleteLessonExercise(42), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync('exercise-1');
    });

    expect(queryClient.getQueryData(lessonKeys.progress(42))).toEqual(progress);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: lessonKeys.lists(),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: lessonKeys.detail(42),
    });
  });
});
