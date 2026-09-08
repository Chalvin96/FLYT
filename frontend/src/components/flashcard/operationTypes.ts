import type { ExerciseOutcome, OperationResult } from '@/lib/operationResult';
import type {
  AudioAsset,
  Exercise,
  SpeechCheck,
  WriteJudgement,
} from '@/types/lesson-contracts';

export type WriteJudgeFn = (response: string) => Promise<WriteJudgement>;
export type SpeechRecorderFn = (audio: Blob) => Promise<SpeechCheck>;
export type FinishResult = void | boolean | Promise<void | boolean>;
export type FinishHandler<T> = (value: T) => FinishResult;
export type OperationOutcome = ExerciseOutcome | OperationResult;

export type OperationComponentProps<T = Exercise> = {
  exercise: T;
  onFinished?: FinishHandler<OperationOutcome>;
  isSubmitting?: boolean;
  className?: string;
  desktopExpanded?: boolean;
  judgeWrite?: WriteJudgeFn;
  audio?: AudioAsset | null;
  recordAndTranscribe?: SpeechRecorderFn;
  draftOwnerKey?: string;
};
