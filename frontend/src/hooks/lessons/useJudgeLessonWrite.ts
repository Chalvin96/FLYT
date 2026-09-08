import { useMemo } from 'react';

import { judgeLessonWrite } from '@/api/lessons';
import type { WriteJudgeFn } from '@/components/flashcard/operationTypes';

export function useJudgeLessonWrite(
  lessonId: number,
  exerciseId: string | null,
): WriteJudgeFn | undefined {
  return useMemo<WriteJudgeFn | undefined>(
    () =>
      exerciseId === null
        ? undefined
        : (response) => judgeLessonWrite(lessonId, exerciseId, response),
    [exerciseId, lessonId],
  );
}
