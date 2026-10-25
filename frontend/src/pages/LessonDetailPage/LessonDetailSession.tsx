import { useMemo } from 'react';

import { ExerciseHost } from '@/components/flashcard/ExerciseHost';
import { FlashCardInfo } from '@/components/flashcard/FlashCardInfo/FlashCardInfo';
import { useIsDesktop } from '@/hooks/ui/useIsDesktop';
import type { AudioAsset } from '@/types/lesson-contracts';

import { LessonLayout } from './components/LessonLayout';
import { LessonStartScreen } from './components/LessonStartScreen';
import { LessonCompletion } from './LessonCompletion';
import {
  buildLessonExerciseAdapter,
  type LessonDetailJudgeWrite,
} from './lessonExerciseAdapter';
import {
  useLessonDetailState,
  type LessonCompletionDestination,
  type LessonDetailActions,
} from './useLessonDetailState';

type LessonDetailSessionProps = {
  lesson: import('@/types/api').LessonDetailRead;
  userId?: number;
  onExit?: (destination: LessonCompletionDestination) => void;
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
    retryCompletion,
  } = state;
  const page = pages[pageIndex];

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
        <LessonCompletion
          desktopExpanded={isDesktop}
          completionStatus={state.completionStatus}
          completedCount={exercisePageCount}
          onPrimaryAction={handleLessonComplete}
          onRetrySave={retryCompletion}
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
          section={page.section}
          audioById={audioById}
          desktopExpanded={isDesktop}
          isSubmitting={isSubmitting}
          onContinue={state.advance}
        />
      ) : (
        <ExerciseHost
          key={page.id}
          adapter={buildLessonExerciseAdapter({
            lessonId: lesson.id,
            schemaVersion: lesson.packet.schema_version,
            exercise: page.exercise,
            userId,
            storyJudgeWrite,
            onUnsupported: () => void handleExerciseFinished(page.exerciseId),
          })}
          desktopExpanded={isDesktop}
          isSubmitting={isSubmitting}
          onFinished={() => handleExerciseFinished(page.exerciseId)}
        />
      )}
    </LessonLayout>
  );
}
