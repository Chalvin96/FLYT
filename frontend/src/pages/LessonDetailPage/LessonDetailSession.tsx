import { useEffect, useMemo } from 'react';

import { transcribeSpeech } from '@/api/speech';
import { ExerciseModeProvider } from '@/components/flashcard/ExerciseModeProvider';
import { ExerciseView } from '@/components/flashcard/ExerciseView';
import { FlashCardInfo } from '@/components/flashcard/FlashCardInfo/FlashCardInfo';
import { FlashCardLessonEnd } from '@/components/flashcard/FlashCardLessonEnd/FlashCardLessonEnd';
import type { WriteJudgeFn } from '@/components/flashcard/operationTypes';
import { useJudgeLessonWrite } from '@/hooks/lessons/useJudgeLessonWrite';
import { useIsDesktop } from '@/hooks/ui/useIsDesktop';
import type { AudioAsset, WriteJudgement } from '@/types/lesson-contracts';

import { LessonLayout } from './components/LessonLayout';
import { LessonStartScreen } from './components/LessonStartScreen';
import {
  useLessonDetailState,
  type LessonDetailActions,
} from './useLessonDetailState';

export type LessonDetailJudgeWrite = (
  exerciseId: string,
  response: string,
) => Promise<WriteJudgement>;

type LessonDetailSessionProps = {
  lesson: import('@/types/api').LessonDetailRead;
  userId?: number;
  onExit?: () => void;
  actions?: LessonDetailActions;
  judgeWrite?: LessonDetailJudgeWrite;
};

export function LessonDetailSession({
  lesson,
  userId,
  onExit,
  actions,
  judgeWrite: storyJudgeWrite,
}: LessonDetailSessionProps) {
  const isDesktop = useIsDesktop();
  const state = useLessonDetailState({ lesson, onExit, actions });
  const audioById = useMemo<Record<string, AudioAsset>>(
    () =>
      Object.fromEntries(
        lesson.media.audio.map((audio) => [
          audio.id,
          {
            id: audio.id,
            url: audio.url,
            path: audio.path,
            mime: audio.mime,
            duration_ms: audio.duration_ms,
            sha256: audio.sha256,
            status: audio.status,
          } satisfies AudioAsset,
        ]),
      ),
    [lesson.media.audio],
  );
  const {
    exercisePageCount,
    handleExerciseFinished,
    handleLessonComplete,
    handleStartLesson,
    hasStarted,
    isComplete,
    isSubmitting,
    pages,
    pageIndex,
    persistCompletion,
  } = state;
  const sessionCardClassName = 'w-full';
  const page = pages[pageIndex];
  const writeExerciseId =
    page?.kind === 'exercise' && page.exercise.operation === 'write'
      ? page.exercise.id
      : null;
  const productionJudgeWrite = useJudgeLessonWrite(lesson.id, writeExerciseId);
  const judgeWrite = useMemo<WriteJudgeFn | undefined>(() => {
    if (writeExerciseId === null) {
      return undefined;
    }
    if (storyJudgeWrite) {
      return (response) => storyJudgeWrite(writeExerciseId, response);
    }
    return productionJudgeWrite;
  }, [productionJudgeWrite, storyJudgeWrite, writeExerciseId]);
  const exerciseAudio =
    page?.kind === 'exercise' && page.exercise.audio_id
      ? (audioById[page.exercise.audio_id] ?? null)
      : null;
  const recordAndTranscribe =
    page?.kind === 'exercise' && page.exercise.operation === 'speak'
      ? transcribeSpeech
      : undefined;

  useEffect(() => {
    if (isComplete) {
      void persistCompletion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  if (!hasStarted) {
    return (
      <LessonStartScreen
        lesson={lesson}
        isSubmitting={isSubmitting}
        onStart={handleStartLesson}
      />
    );
  }

  if (isComplete) {
    return (
      <LessonLayout
        title={lesson.title}
        progressCurrent={pages.length}
        totalPages={pages.length}
        progressPercent={100}
        pages={pages}
      >
        <FlashCardLessonEnd
          className={sessionCardClassName}
          desktopExpanded={isDesktop}
          isSubmitting={isSubmitting}
          completedCount={exercisePageCount}
          onFinished={handleLessonComplete}
        />
      </LessonLayout>
    );
  }

  if (!page) {
    return null;
  }

  return (
    <LessonLayout
      title={lesson.title}
      progressCurrent={state.progressCurrent}
      totalPages={pages.length}
      progressPercent={state.progressPercent}
      pages={pages}
      maxReachedIndex={state.maxReachedIndex}
      onGoToPage={state.goToPage}
    >
      {page.kind === 'section' ? (
        <FlashCardInfo
          key={page.id}
          section={{
            kind: 'section',
            id: page.sectionId,
            role: page.role,
            title: page.title,
            objective_ids:
              lesson.packet.sections.find(
                (section) => section.id === page.sectionId,
              )?.objective_ids ?? [],
            blocks: page.blocks,
          }}
          audioById={audioById}
          className={sessionCardClassName}
          desktopExpanded={isDesktop}
          isSubmitting={isSubmitting}
          onContinue={state.advance}
        />
      ) : (
        <ExerciseModeProvider allowRetry>
          <ExerciseView
            key={page.id}
            exercise={page.exercise}
            className={sessionCardClassName}
            desktopExpanded={isDesktop}
            isSubmitting={isSubmitting}
            judgeWrite={judgeWrite}
            audio={exerciseAudio}
            recordAndTranscribe={recordAndTranscribe}
            draftOwnerKey={`user-${userId ?? 'anonymous'}-lesson-${lesson.id}`}
            onContinue={state.advance}
            onFinished={() => handleExerciseFinished(page.exerciseId)}
          />
        </ExerciseModeProvider>
      )}
    </LessonLayout>
  );
}
