import type { ExerciseOutcome } from '@/lib/operationResult';
import type { Exercise, WriteJudgement } from '@/types/lesson-contracts';

import type { FlashCardFrameLayout } from './FlashCardFrame';

export type WriteJudgeFn = (response: string) => Promise<WriteJudgement>;
export type FinishResult = void | boolean | Promise<void | boolean>;
export type FinishHandler<T> = (value: T) => FinishResult;

export type OperationComponentProps<T = Exercise> = {
  exercise: T;
  allowRetry: boolean;
  onFinished?: FinishHandler<ExerciseOutcome>;
  isSubmitting?: boolean;
  layout?: FlashCardFrameLayout;
  desktopExpanded?: boolean;
};
