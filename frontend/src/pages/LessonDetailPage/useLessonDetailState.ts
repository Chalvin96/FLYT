import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';

import {
  useCompleteLesson,
  useCompleteLessonExercise,
  useStartLesson,
} from '@/hooks/lessons/queries';
import { deriveLessonPages } from '@/lib/lessonPages';
import { type LessonDetailRead, type LessonProgressRead } from '@/types/api';

type LessonPage = ReturnType<typeof deriveLessonPages>[number];

export const LESSON_COMPLETION_DESTINATIONS = {
  review: 'review',
  home: 'home',
} as const;

export type LessonCompletionDestination =
  (typeof LESSON_COMPLETION_DESTINATIONS)[keyof typeof LESSON_COMPLETION_DESTINATIONS];

export const LESSON_COMPLETION_STATUSES = {
  pending: 'pending',
  saved: 'saved',
  error: 'error',
} as const;

export type LessonCompletionStatus =
  (typeof LESSON_COMPLETION_STATUSES)[keyof typeof LESSON_COMPLETION_STATUSES];

function deriveInitialPageIndex(
  pages: LessonPage[],
  progress: LessonProgressRead | null,
): number {
  if (!progress) {
    return 0;
  }
  if (progress.completed_at) {
    return pages.length;
  }

  const completedIds = new Set(progress.completed_exercise_ids);
  let lastCompletedIndex = -1;
  for (const [index, page] of pages.entries()) {
    if (page.kind !== 'exercise') {
      continue;
    }
    if (!completedIds.has(page.exerciseId)) {
      return lastCompletedIndex + 1;
    }
    lastCompletedIndex = index;
  }
  return lastCompletedIndex + 1;
}

export type LessonDetailActions = {
  startLesson: () => Promise<LessonProgressRead>;
  completeLesson: () => Promise<void>;
  completeLessonExercise: (exerciseId: string) => Promise<LessonProgressRead>;
};

type UseLessonDetailStateArgs = {
  lesson: LessonDetailRead;
  onExit?: (destination: LessonCompletionDestination) => void;
  actions?: LessonDetailActions;
};

export function useLessonDetailState({
  lesson,
  onExit,
  actions,
}: UseLessonDetailStateArgs) {
  const pages = useMemo(
    () => deriveLessonPages(lesson.packet),
    [lesson.packet],
  );
  const exercisePages = useMemo(
    () => pages.filter((page) => page.kind === 'exercise'),
    [pages],
  );

  const initialPageIndex = deriveInitialPageIndex(pages, lesson.progress);
  const [completedIds, setCompletedIds] = useState<string[]>(
    () => lesson.progress?.completed_exercise_ids ?? [],
  );
  const [started, setStarted] = useState(() =>
    Boolean(lesson.progress && !lesson.progress.completed_at),
  );
  const [completionStatus, setCompletionStatus] =
    useState<LessonCompletionStatus>(() =>
      lesson.progress?.completed_at
        ? LESSON_COMPLETION_STATUSES.saved
        : LESSON_COMPLETION_STATUSES.pending,
    );
  const completed = useMemo(() => new Set(completedIds), [completedIds]);
  const [pageIndex, setPageIndex] = useState(initialPageIndex);
  const pageIndexRef = useRef(initialPageIndex);
  const [maxReachedIndex, setMaxReachedIndex] = useState(initialPageIndex);

  const startLessonMutation = useStartLesson();
  const completeLessonMutation = useCompleteLesson();
  const completeExerciseMutation = useCompleteLessonExercise(lesson.id);
  const startLesson =
    actions?.startLesson ?? (() => startLessonMutation.mutateAsync(lesson.id));
  const completeLesson =
    actions?.completeLesson ??
    (() => completeLessonMutation.mutateAsync(lesson.id));
  const completeExercise =
    actions?.completeLessonExercise ??
    ((exerciseId: string) => completeExerciseMutation.mutateAsync(exerciseId));

  const isSubmitting =
    startLessonMutation.isPending ||
    completeExerciseMutation.isPending ||
    completeLessonMutation.isPending;

  const hasStarted = started;
  const isComplete = started && pageIndex >= pages.length;
  const completedExerciseCount = exercisePages.filter((page) =>
    completed.has(page.kind === 'exercise' ? page.exerciseId : ''),
  ).length;
  const progressCurrent = Math.min(pageIndex, pages.length);
  const progressPercent =
    pages.length === 0 ? 0 : Math.round((progressCurrent / pages.length) * 100);

  async function handleStartLesson() {
    if (isSubmitting) {
      return;
    }
    try {
      await startLesson();
    } catch {
      return;
    }
    setCompletedIds([]);
    pageIndexRef.current = 0;
    setPageIndex(0);
    setMaxReachedIndex(0);
    setCompletionStatus(LESSON_COMPLETION_STATUSES.pending);
    setStarted(true);
  }

  function advanceTo(index: number) {
    const next = Math.min(index, pages.length);
    pageIndexRef.current = next;
    setPageIndex(next);
    setMaxReachedIndex((max) => Math.max(max, next));
  }

  function advance() {
    advanceTo(pageIndexRef.current + 1);
  }

  function goToPage(target: number) {
    const next = Math.max(0, Math.min(target, maxReachedIndex));
    pageIndexRef.current = next;
    setPageIndex(next);
  }

  async function handleExerciseFinished(exerciseId: string): Promise<boolean> {
    if (isSubmitting) {
      return false;
    }
    if (completed.has(exerciseId)) {
      advance();
      return true;
    }
    const submittedIndex = pageIndexRef.current;
    try {
      const progress = await completeExercise(exerciseId);
      setCompletedIds(progress.completed_exercise_ids);
    } catch {
      return false;
    }
    advanceTo(submittedIndex + 1);
    return true;
  }

  async function persistCompletion(): Promise<boolean> {
    if (
      completeLessonMutation.isPending ||
      completionStatus === LESSON_COMPLETION_STATUSES.saved
    ) {
      return completionStatus === LESSON_COMPLETION_STATUSES.saved;
    }
    setCompletionStatus(LESSON_COMPLETION_STATUSES.pending);
    try {
      await completeLesson();
      setCompletionStatus(LESSON_COMPLETION_STATUSES.saved);
      return true;
    } catch {
      setCompletionStatus(LESSON_COMPLETION_STATUSES.error);
      return false;
    }
  }

  const saveCompletionOnEntry = useEffectEvent(() => {
    void persistCompletion();
  });

  useEffect(() => {
    if (isComplete) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      saveCompletionOnEntry();
    }
  }, [isComplete]);

  async function handleLessonComplete(
    destination: LessonCompletionDestination,
  ) {
    if (await persistCompletion()) {
      onExit?.(destination);
    }
  }

  return {
    advance,
    completed,
    completedExerciseCount,
    completionStatus,
    exercisePageCount: exercisePages.length,
    handleExerciseFinished,
    handleLessonComplete,
    handleStartLesson,
    hasStarted,
    isComplete,
    isSubmitting,
    maxReachedIndex,
    pages,
    progressCurrent,
    progressPercent,
    retryCompletion: persistCompletion,
    goToPage,
    pageIndex,
  };
}
