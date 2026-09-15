import { gradedOutcome, type ExerciseOutcome } from '@/lib/operationResult';
import type { Exercise } from '@/types/lesson-contracts';

import { K_OPERATION_COMPONENT_MAP } from './componentMap';
import type {
  FinishHandler,
  OperationComponentProps,
  WriteJudgeFn,
} from './operationTypes';
import { UnsupportedFlashcardCard } from './UnsupportedFlashcardCard';

type ExerciseViewProps = Omit<
  OperationComponentProps,
  'exercise' | 'onFinished'
> & {
  exercise: Exercise;
  onContinue?: () => void;
  onFinished?: FinishHandler<ExerciseOutcome>;
  judgeWrite?: WriteJudgeFn;
};

export function ExerciseView({
  exercise,
  className,
  desktopExpanded,
  isSubmitting,
  judgeWrite,
  audio,
  recordAndTranscribe,
  draftOwnerKey,
  onContinue,
  onFinished,
}: ExerciseViewProps) {
  const Component = K_OPERATION_COMPONENT_MAP[exercise.operation];

  if (!Component) {
    return (
      <UnsupportedFlashcardCard
        cardType={exercise.operation}
        isSubmitting={Boolean(isSubmitting)}
        onContinue={
          onContinue ?? (() => onFinished?.(gradedOutcome({ correct: false })))
        }
      />
    );
  }

  return (
    <Component
      exercise={exercise}
      className={className}
      desktopExpanded={desktopExpanded}
      isSubmitting={isSubmitting}
      judgeWrite={judgeWrite}
      audio={audio}
      recordAndTranscribe={recordAndTranscribe}
      draftOwnerKey={draftOwnerKey}
      onFinished={onFinished}
    />
  );
}
