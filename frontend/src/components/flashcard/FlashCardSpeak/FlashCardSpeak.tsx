import { Mic } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/common/Button/Button';
import { AudioPlayButton } from '@/components/portable/AudioPlayButton';
import {
  gradedOutcome,
  type ExerciseOutcome,
  type OperationResult,
} from '@/lib/operationResult';
import { cn } from '@/lib/utils';
import type {
  AudioAsset,
  SpeakExercise,
  SpeechCheck,
} from '@/types/lesson-contracts';

import { withOperationTimeout } from '../operationRequest';
import { OperationShell } from '../OperationShell';
import type { FinishHandler, SpeechRecorderFn } from '../operationTypes';
import {
  compareTranscript,
  isTranscriptPassing,
  type DiffToken,
} from './transcriptDiff';

export type SpeakPhase =
  | 'permission'
  | 'ready'
  | 'recording'
  | 'pending'
  | 'reviewed'
  | 'denied'
  | 'error';

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

const MAX_RECORDING_MS = 15_000;

const STATUS: Record<SpeakPhase, string> = {
  permission: 'Microphone needed',
  ready: 'Tap to speak',
  recording: 'Listening…',
  pending: 'Checking your recording…',
  reviewed: 'Try again, or check to move on',
  denied: 'Microphone unavailable',
  error: "We couldn't check that recording",
};

function TargetSentence({ target }: { target: string }) {
  return (
    <p
      lang="no"
      className="font-display type-title sm:type-display leading-prompt font-semibold text-balance"
    >
      {target}
    </p>
  );
}

function SpokenTranscript({ tokens }: { tokens: DiffToken[] }) {
  return (
    <p lang="no" className="type-body text-foreground">
      {tokens.map((token, index) => (
        <span
          key={index}
          className={cn(
            !token.matched &&
              'rounded-sm bg-destructive-0 px-0.5 font-semibold text-destructive-80 underline decoration-wavy underline-offset-4',
          )}
        >
          {token.text}
          {index < tokens.length - 1 ? ' ' : ''}
        </span>
      ))}
    </p>
  );
}

const MODEL_WAVE = [
  38, 62, 45, 88, 70, 100, 82, 55, 96, 68, 40, 74, 52, 86, 60, 34,
];

function ModelWaveform() {
  return (
    <span aria-hidden="true" className="flex h-6 items-center gap-[3px]">
      {MODEL_WAVE.map((height, index) => (
        <span
          key={index}
          className="bg-secondary-30 w-[3px] rounded-full"
          style={{ height: `${height}%` }}
        />
      ))}
    </span>
  );
}

function LevelMeter({ animate }: { animate: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-4 w-4 items-end justify-center gap-[2px]"
    >
      {[0, 1, 2, 3].map((bar) => (
        <span
          key={bar}
          className={cn(
            'w-[2px] rounded-full bg-current',
            animate && 'animate-pulse',
          )}
          style={{
            height: animate ? `${40 + ((bar * 37) % 55)}%` : '55%',
            animationDelay: `${bar * 110}ms`,
          }}
        />
      ))}
    </span>
  );
}

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
  const [phase, setPhase] = useState<SpeakPhase>(
    initialPhase ?? (micGranted ? 'ready' : 'permission'),
  );
  const [transcript, setTranscript] = useState<string | null>(
    initialTranscript ?? null,
  );
  const [result, setResult] = useState<OperationResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const stopRecorderRef = useRef<(() => void) | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingAttemptRef = useRef(0);
  const transcriptionAttemptRef = useRef(0);
  const reducedMotionPreference = useReducedMotion();
  const reducedMotion = Boolean(reducedMotionPreference);

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function releaseRecorder() {
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
    }
    recorderRef.current = null;
    stopRecorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    chunksRef.current = [];
  }

  useEffect(() => {
    return () => {
      recordingAttemptRef.current += 1;
      transcriptionAttemptRef.current += 1;
      clearTimer();
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        if (recorder.state !== 'inactive') recorder.stop();
      }
      releaseRecorder();
    };
  }, []);

  const target = exercise.payload.target;
  const comparison = transcript ? compareTranscript(target, transcript) : null;
  const missing = comparison?.target.filter((token) => !token.matched) ?? [];
  const didPass = transcript ? isTranscriptPassing(target, transcript) : false;

  function applyTranscript(check: SpeechCheck) {
    setTranscript(check.transcript);
    setPhase('reviewed');
  }

  function submitTranscription(request: Promise<SpeechCheck>) {
    const attempt = transcriptionAttemptRef.current + 1;
    transcriptionAttemptRef.current = attempt;
    setPhase('pending');
    void withOperationTimeout(request)
      .then((check) => {
        if (attempt === transcriptionAttemptRef.current) {
          applyTranscript(check);
        }
      })
      .catch(() => {
        if (attempt === transcriptionAttemptRef.current) {
          setPhase('error');
        }
      });
  }

  function stopAndTranscribe() {
    clearTimer();
    const recorder = recorderRef.current;
    if (recorder) {
      const stopRecorder = stopRecorderRef.current;
      if (stopRecorder) {
        stopRecorder();
      } else {
        releaseRecorder();
        setPhase('error');
      }
      return;
    }

    if (!transcribe) {
      setPhase('error');
      return;
    }
    try {
      submitTranscription(transcribe());
    } catch {
      setPhase('error');
    }
  }

  function startRecording() {
    if (!recordAndTranscribe) {
      if (!transcribe) {
        setPhase('error');
        return;
      }
      setPhase('recording');
      timerRef.current = setTimeout(stopAndTranscribe, MAX_RECORDING_MS);
      return;
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setPhase('denied');
      return;
    }

    const attempt = recordingAttemptRef.current + 1;
    recordingAttemptRef.current = attempt;
    void navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        if (attempt !== recordingAttemptRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        chunksRef.current = [];
        const supportedType = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mp4',
        ].find((type) => MediaRecorder.isTypeSupported(type));
        const recorder = supportedType
          ? new MediaRecorder(stream, { mimeType: supportedType })
          : new MediaRecorder(stream);
        recorderRef.current = recorder;
        let stopRequested = false;
        let finalized = false;
        const finalizeRecording = (shouldTranscribe: boolean) => {
          if (finalized || recorderRef.current !== recorder) return;
          finalized = true;
          const audio = new Blob(chunksRef.current, {
            type: recorder.mimeType || 'audio/webm',
          });
          releaseRecorder();
          if (!shouldTranscribe || !audio.size || !recordAndTranscribe) {
            setPhase('error');
            return;
          }
          try {
            submitTranscription(recordAndTranscribe(audio));
          } catch {
            setPhase('error');
          }
        };
        const stopRecorder = () => {
          stopRequested = true;
          if (recorder.state === 'inactive') {
            finalizeRecording(false);
            return;
          }
          try {
            recorder.stop();
          } catch {
            finalizeRecording(false);
          }
        };
        stopRecorderRef.current = stopRecorder;
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.onstop = () => finalizeRecording(stopRequested);
        recorder.onerror = () => finalizeRecording(false);
        try {
          recorder.start();
        } catch {
          finalizeRecording(false);
          return;
        }
        setPhase('recording');
        timerRef.current = setTimeout(stopAndTranscribe, MAX_RECORDING_MS);
      })
      .catch(() => {
        if (attempt === recordingAttemptRef.current) {
          releaseRecorder();
          setPhase('denied');
        }
      });
  }

  function commit() {
    setResult({ correct: didPass });
  }

  function finishUngraded(outcome: 'skipped' | 'service_unavailable') {
    return onFinished?.({ kind: 'ungraded', outcome });
  }

  function finish() {
    return result ? onFinished?.(gradedOutcome(result)) : undefined;
  }

  function skip() {
    recordingAttemptRef.current += 1;
    transcriptionAttemptRef.current += 1;
    clearTimer();
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      if (recorder.state !== 'inactive') recorder.stop();
      releaseRecorder();
    }
    finishUngraded(phase === 'error' ? 'service_unavailable' : 'skipped');
  }

  const isRecordable =
    phase === 'permission' || phase === 'ready' || phase === 'recording';
  const blocked = phase === 'denied' || phase === 'error';

  return (
    <OperationShell
      exercise={exercise}
      className={className}
      desktopExpanded={desktopExpanded}
      isSubmitting={isSubmitting}
      statusHint={STATUS[phase]}
      canCheck={phase === 'reviewed'}
      pending={phase === 'pending'}
      pendingLabel="Checking…"
      result={result}
      wrongHint={
        comparison && !didPass ? 'Listen to the model and try again.' : null
      }
      escapeAction={
        result || phase === 'pending' ? null : (
          <Button
            variant="ghost"
            className="w-full text-muted-foreground sm:w-auto"
            onClick={skip}
          >
            {phase === 'denied'
              ? 'Continue without speaking'
              : "Can't speak now"}
          </Button>
        )
      }
      onCheck={commit}
      onContinue={finish}
    >
      <p className="sr-only" role="status" aria-live="polite">
        {STATUS[phase]}
        {phase === 'reviewed' && transcript ? ` We heard: ${transcript}.` : ''}
      </p>

      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-5">
          <TargetSentence target={target} />
          <div className="radius-field border-border bg-card flex items-center gap-3 border py-1.5 pr-4 pl-2">
            <AudioPlayButton asset={audio} label="Play the model" />
            <ModelWaveform />
          </div>
        </div>

        {isRecordable ? (
          <Button
            size="lg"
            className={cn(
              'h-13 w-full sm:w-auto sm:min-w-56',
              phase === 'recording'
                ? 'border border-border bg-card text-foreground hover:border-destructive-20 hover:bg-destructive-0 hover:text-destructive-80'
                : 'bg-primary-70 hover:bg-primary-80',
            )}
            onClick={phase === 'recording' ? stopAndTranscribe : startRecording}
          >
            {phase === 'recording' ? (
              <LevelMeter animate={!reducedMotion} />
            ) : (
              <Mic aria-hidden="true" className="size-4" />
            )}
            {phase === 'recording' ? 'Stop recording' : 'Tap to speak'}
          </Button>
        ) : null}

        {phase === 'reviewed' && comparison && !result ? (
          <div className="flex w-full flex-col items-center gap-3">
            <div className="radius-field bg-secondary-5 w-full px-4 py-3">
              <p className="type-label text-muted-foreground mb-1">We heard</p>
              <SpokenTranscript tokens={comparison.spoken} />
              {missing.length ? (
                <div data-testid="missing-transcript" className="mt-3">
                  <p className="type-label text-muted-foreground mb-1">
                    Missing
                  </p>
                  <SpokenTranscript tokens={missing} />
                </div>
              ) : null}
            </div>
            <Button
              variant="outline"
              className="w-full sm:w-auto sm:min-w-56"
              onClick={() => setPhase('ready')}
            >
              <Mic aria-hidden="true" className="size-4" />
              Record again
            </Button>
          </div>
        ) : null}

        {blocked ? (
          <div className="radius-field flex w-full flex-col items-center gap-3 border border-warning-30 bg-warning-10 p-4">
            <p className="type-caption text-foreground">
              {phase === 'denied'
                ? 'Flyt cannot reach your microphone. Check your browser’s site permissions to enable it.'
                : 'We could not check that recording. Your connection may have dropped.'}
            </p>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setPhase('ready')}
            >
              {phase === 'denied' ? 'I have enabled it' : 'Try again'}
            </Button>
          </div>
        ) : null}
      </div>
    </OperationShell>
  );
}
