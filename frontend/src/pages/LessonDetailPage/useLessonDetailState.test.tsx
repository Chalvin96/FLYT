import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { LessonDetailRead, LessonProgressRead } from '@/types/api';

import {
  useLessonDetailState,
  type LessonCompletionDestination,
  type LessonDetailActions,
} from './useLessonDetailState';

const lesson: LessonDetailRead = {
  id: 42,
  source_id: 'cafe-order',
  kind: 'communicative',
  family_id: 'basics',
  title: 'At the café',
  cefr_level: 'A1',
  goal: 'Order at a café.',
  order: 1,
  estimated_minutes: 5,
  packet: {
    schema_version: '4.0',
    id: 'cafe-order',
    kind: 'communicative',
    language: 'nb-NO',
    title: 'At the café',
    cefr_level: 'A1',
    goal: 'Order at a café.',
    objectives: [],
    content: [],
    sections: [],
    exercises: [],
    practice_groups: [],
    media: { audio: [] },
  },
  media: { audio: [] },
  progress: null,
};

function makeActions(
  completeLesson: LessonDetailActions['completeLesson'],
): LessonDetailActions {
  return {
    startLesson: vi.fn().mockResolvedValue({
      completed_exercise_ids: [],
      completed_at: null,
    }),
    completeLesson,
    completeLessonExercise: vi.fn(),
  };
}

type HookProps = {
  onExit: (destination: LessonCompletionDestination) => void;
  actions: LessonDetailActions;
};

function renderLessonState(progress: LessonProgressRead, props: HookProps) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderHook(
    ({ onExit, actions }: HookProps) =>
      useLessonDetailState({
        lesson: { ...lesson, progress },
        onExit,
        actions,
      }),
    {
      initialProps: props,
      wrapper: function QueryWrapper({ children }: { children: ReactNode }) {
        return (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        );
      },
    },
  );
}

describe('useLessonDetailState completion', () => {
  it('test_lesson_completion_given_complete_unfinished_lesson_expect_save_without_caller_effect', async () => {
    let resolveSave = () => {};
    const completeLesson = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const onExit = vi.fn();
    const { result, rerender } = renderLessonState(
      { completed_exercise_ids: [], completed_at: null },
      { onExit, actions: makeActions(completeLesson) },
    );

    expect(completeLesson).toHaveBeenCalledTimes(1);
    expect(result.current.completionStatus).toBe('pending');
    expect(onExit).not.toHaveBeenCalled();

    await act(async () => {
      resolveSave();
    });
    expect(result.current.completionStatus).toBe('saved');

    rerender({ onExit, actions: makeActions(completeLesson) });

    expect(completeLesson).toHaveBeenCalledTimes(1);
    expect(result.current.completionStatus).toBe('saved');
    expect(onExit).not.toHaveBeenCalled();
  });

  it('test_lesson_completion_given_failed_save_and_rerender_expect_error_until_explicit_retry', async () => {
    const completeLesson = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const onExit = vi.fn();
    const actions = makeActions(completeLesson);
    const { result, rerender } = renderLessonState(
      { completed_exercise_ids: [], completed_at: null },
      { onExit, actions },
    );

    await waitFor(() => expect(result.current.completionStatus).toBe('error'));

    rerender({
      onExit: (destination) => onExit(destination),
      actions: { ...actions },
    });

    expect(completeLesson).toHaveBeenCalledTimes(1);
    expect(result.current.completionStatus).toBe('error');

    let retried: boolean | undefined;
    await act(async () => {
      retried = await result.current.retryCompletion();
    });
    expect(retried).toBe(true);
    expect(result.current.completionStatus).toBe('saved');

    await act(async () => {
      await result.current.handleLessonComplete('home');
    });

    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledWith('home');
    expect(completeLesson).toHaveBeenCalledTimes(2);
  });

  it('test_lesson_completion_given_restored_completed_lesson_expect_restart_state_without_save', async () => {
    const completeLesson = vi.fn().mockResolvedValue(undefined);
    const onExit = vi.fn();
    const { result, rerender } = renderLessonState(
      {
        completed_exercise_ids: ['exercise-1'],
        completed_at: '2026-08-01T00:00:00Z',
      },
      { onExit, actions: makeActions(completeLesson) },
    );

    expect(result.current.hasStarted).toBe(false);
    expect(result.current.isComplete).toBe(false);
    expect(result.current.completionStatus).toBe('saved');

    rerender({ onExit, actions: makeActions(completeLesson) });

    expect(completeLesson).not.toHaveBeenCalled();
    expect(result.current.completionStatus).toBe('saved');
    expect(result.current.hasStarted).toBe(false);
  });
});
