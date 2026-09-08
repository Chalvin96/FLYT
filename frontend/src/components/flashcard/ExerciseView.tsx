import { gradedOutcome, type ExerciseOutcome } from '@/lib/operationResult';
import type { Exercise } from '@/types/lesson-contracts';

import { K_OPERATION_COMPONENT_MAP } from './componentMap';
import type {
  FinishHandler,
  OperationComponentProps,
  OperationOutcome,
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
  const finish = onFinished
    ? (outcome: OperationOutcome) => {
        if ('kind' in outcome) {
          return onFinished(outcome);
        } else {
          return onFinished(gradedOutcome(outcome));
        }
      }
    : undefined;

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
      onFinished={finish}
    />
  );
}
