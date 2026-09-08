import { useReducedMotion } from 'motion/react';
import { useState } from 'react';

import {
  gradedOutcome,
  type ExerciseOutcome,
  type OperationResult,
} from '@/lib/operationResult';
import type {
  AudioAsset,
  SpeakExercise,
  SpeechCheck,
} from '@/types/lesson-contracts';

import { OperationShell } from '../OperationShell';
import type { FinishHandler, SpeechRecorderFn } from '../operationTypes';
import {
  SpeakBlockedNotice,
  SpeakModelAudio,
  SpeakRecordButton,
  SpeakReviewPanel,
  TargetSentence,
} from './FlashCardSpeakSurface';
import { SpeakEscapeAction, SpeakLiveStatus } from './SpeakLiveStatus';
import { buildSpeakReview, SPEAK_STATUS } from './speakView';
import { useSpeakSession, type SpeakPhase } from './useSpeakSession';

export type { SpeakPhase };

type FlashCardSpeakProps = {
  exercise: SpeakExercise;
  audio?: AudioAsset | null;
  onFinished?: FinishHandler<ExerciseOutcome>;
  isSubmitting?: boolean;
  className?: string;
  desktopExpanded?: boolean;
  transcribe?: () => Promise<SpeechCheck>;
  recordAndTranscribe?: SpeechRecorderFn;
  initialPhase?: SpeakPhase;
  initialTranscript?: string;
  micGranted?: boolean;
};

export function FlashCardSpeak({
  exercise,
  audio,
  onFinished,
  isSubmitting,
  className,
  desktopExpanded,
  transcribe,
  recordAndTranscribe,
  initialPhase,
  initialTranscript,
  micGranted = false,
}: FlashCardSpeakProps) {
  const {
    abortSession,
    phase,
    restart,
    startRecording,
    stopAndTranscribe,
    transcript,
  } = useSpeakSession({
    initialPhase,
    initialTranscript,
    micGranted,
    recordAndTranscribe,
    transcribe,
  });
  const [result, setResult] = useState<OperationResult | null>(null);
  const reducedMotionPreference = useReducedMotion();
  const reducedMotion = Boolean(reducedMotionPreference);

  const review = buildSpeakReview(exercise.payload.target, transcript);

  function commit() {
    setResult({ correct: review.didPass });
  }

  function finish() {
    return result ? onFinished?.(gradedOutcome(result)) : undefined;
  }

  function skip() {
    abortSession();
    const outcome = phase === 'error' ? 'service_unavailable' : 'skipped';
    return onFinished?.({ kind: 'ungraded', outcome });
  }

  return (
    <OperationShell
      canCheck={phase === 'reviewed'}
      className={className}
      desktopExpanded={desktopExpanded}
      escapeAction={
        <SpeakEscapeAction
          onSkip={skip}
          phase={phase}
          visible={!result && phase !== 'pending'}
        />
      }
      exercise={exercise}
      isSubmitting={isSubmitting}
      onCheck={commit}
      onContinue={finish}
      pending={phase === 'pending'}
      pendingLabel="Checking…"
      result={result}
      statusHint={SPEAK_STATUS[phase]}
      wrongHint={
        review.comparison && !review.didPass
          ? 'Listen to the model and try again.'
          : null
      }
    >
      <SpeakLiveStatus phase={phase} transcript={transcript} />

      <SpeakSurface
        audio={audio}
        exercise={exercise}
        phase={phase}
        reducedMotion={reducedMotion}
        result={result}
        review={review}
        onRecordClick={
          phase === 'recording' ? stopAndTranscribe : startRecording
        }
        onRestart={restart}
      />
    </OperationShell>
  );
}

function SpeakSurface({
  audio,
  exercise,
  phase,
  reducedMotion,
  result,
  review,
  onRecordClick,
  onRestart,
}: {
  audio?: AudioAsset | null;
  exercise: SpeakExercise;
  phase: SpeakPhase;
  reducedMotion: boolean;
  result: OperationResult | null;
  review: ReturnType<typeof buildSpeakReview>;
  onRecordClick: () => void;
  onRestart: () => void;
}) {
  const isRecordable =
    phase === 'permission' || phase === 'ready' || phase === 'recording';
  const blocked = phase === 'denied' || phase === 'error';

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-8 text-center">
      <div className="flex flex-col items-center gap-5">
        <TargetSentence target={exercise.payload.target} />
        <SpeakModelAudio audio={audio} />
      </div>

      {isRecordable ? (
        <SpeakRecordButton
          isRecording={phase === 'recording'}
          onClick={onRecordClick}
          reducedMotion={reducedMotion}
        />
      ) : null}

      {phase === 'reviewed' && review.comparison && !result ? (
        <SpeakReviewPanel
          comparison={review.comparison}
          missing={review.missing}
          onRecordAgain={onRestart}
        />
      ) : null}

      {blocked ? (
        <SpeakBlockedNotice isDenied={phase === 'denied'} onRetry={onRestart} />
      ) : null}
    </div>
  );
}
