import { judgeLessonWrite } from '@/api/lessons';
import {
  buildDraftOwnerKey,
  type ExerciseHostAdapter,
} from '@/components/flashcard/exerciseAdapter';
import type { Exercise, WriteJudgement } from '@/types/lesson-contracts';

export type LessonDetailJudgeWrite = (
  exerciseId: string,
  response: string,
) => Promise<WriteJudgement>;

export function buildLessonExerciseAdapter({
  lessonId,
  schemaVersion,
  exercise,
  userId,
  storyJudgeWrite,
  onUnsupported,
}: {
  lessonId: number;
  schemaVersion: string;
  exercise: Exercise;
  userId?: number;
  storyJudgeWrite?: LessonDetailJudgeWrite;
  onUnsupported: () => void;
}): ExerciseHostAdapter {
  return {
    source: exercise,
    cardType: exercise.operation,
    schemaVersion,
    allowRetry: true,
    draftOwnerKey: buildDraftOwnerKey({
      userId,
      scope: 'lesson',
      scopeId: lessonId,
    }),
    findWriteJudge: (writeExercise) => (response) =>
      storyJudgeWrite
        ? storyJudgeWrite(writeExercise.id, response)
        : judgeLessonWrite(lessonId, writeExercise.id, response),
    onUnsupported,
  };
}
