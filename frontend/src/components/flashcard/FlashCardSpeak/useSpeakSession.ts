import { useCallback, useEffect, useRef, useState } from 'react';

import type { SpeechCheck } from '@/types/lesson-contracts';

import { withOperationTimeout } from '../operationRequest';
import type { SpeechRecorderFn } from '../operationTypes';
import {
  requestSpeechRecording,
  type SpeechRecordingHandle,
} from './recorderSession';

export type SpeakPhase =
  | 'permission'
  | 'ready'
  | 'recording'
  | 'pending'
  | 'reviewed'
  | 'denied'
  | 'error';

const MAX_RECORDING_MS = 15_000;

/**
 * Drives the speak exercise state machine (permission → recording →
 * pending → reviewed, with denied/error escapes) and owns the mic
 * session lifecycle. Recording wiring lives in `recorderSession`.
 */
export function useSpeakSession({
  initialPhase,
  initialTranscript,
  micGranted,
  recordAndTranscribe,
  transcribe,
}: {
  initialPhase?: SpeakPhase;
  initialTranscript?: string;
  micGranted: boolean;
  recordAndTranscribe?: SpeechRecorderFn;
  transcribe?: () => Promise<SpeechCheck>;
}) {
  const [phase, setPhase] = useState<SpeakPhase>(
    initialPhase ?? (micGranted ? 'ready' : 'permission'),
  );
  const [transcript, setTranscript] = useState<string | null>(
    initialTranscript ?? null,
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleRef = useRef<SpeechRecordingHandle | null>(null);
  const sessionGenerationRef = useRef(0);
  const transcriptionAttemptRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const detachRecording = useCallback(() => {
    handleRef.current?.detach();
    handleRef.current = null;
  }, []);

  useEffect(
    () => () => {
      sessionGenerationRef.current += 1;
      transcriptionAttemptRef.current += 1;
      clearTimer();
      detachRecording();
    },
    [clearTimer, detachRecording],
  );

  const submitTranscription = useCallback((request: Promise<SpeechCheck>) => {
    const attempt = transcriptionAttemptRef.current + 1;
    transcriptionAttemptRef.current = attempt;
    setPhase('pending');
    void withOperationTimeout(request)
      .then((check) => {
        if (attempt === transcriptionAttemptRef.current) {
          setTranscript(check.transcript);
          setPhase('reviewed');
        }
      })
      .catch(() => {
        if (attempt === transcriptionAttemptRef.current) {
          setPhase('error');
        }
      });
  }, []);

  const stopAndTranscribe = useCallback(() => {
    clearTimer();
    const handle = handleRef.current;
    if (handle) {
      handleRef.current = null;
      handle.stop();
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
  }, [clearTimer, submitTranscription, transcribe]);

  const startRecording = useCallback(() => {
    if (!recordAndTranscribe) {
      startWithoutRecorder({
        setPhase,
        stopAndTranscribe,
        timerRef,
        transcribe,
      });
      return;
    }

    const generation = sessionGenerationRef.current + 1;
    sessionGenerationRef.current = generation;
    requestSpeechRecording({
      isCurrent: () => generation === sessionGenerationRef.current,
      onDenied: () => setPhase('denied'),
      onError: () => setPhase('error'),
      onRecordingStarted: (handle) => {
        handleRef.current = handle;
        setPhase('recording');
        timerRef.current = setTimeout(stopAndTranscribe, MAX_RECORDING_MS);
      },
      onTranscribe: submitTranscription,
      recordAndTranscribe,
    });
  }, [recordAndTranscribe, stopAndTranscribe, submitTranscription, transcribe]);

  /** Drop any live recording or in-flight transcription (Skip path). */
  const abortSession = useCallback(() => {
    sessionGenerationRef.current += 1;
    transcriptionAttemptRef.current += 1;
    clearTimer();
    detachRecording();
  }, [clearTimer, detachRecording]);

  const restart = useCallback(() => {
    setPhase('ready');
  }, []);

  return {
    abortSession,
    phase,
    restart,
    setPhase,
    startRecording,
    stopAndTranscribe,
    transcript,
  };
}

/**
 * Fallback flow for environments without a recorder implementation:
 * pretend to record, then transcribe via `transcribe` on stop/timeout.
 */
function startWithoutRecorder({
  setPhase,
  stopAndTranscribe,
  timerRef,
  transcribe,
}: {
  setPhase: (phase: SpeakPhase) => void;
  stopAndTranscribe: () => void;
  timerRef: { current: ReturnType<typeof setTimeout> | null };
  transcribe?: () => Promise<SpeechCheck>;
}) {
  if (!transcribe) {
    setPhase('error');
    return;
  }
  setPhase('recording');
  timerRef.current = setTimeout(stopAndTranscribe, MAX_RECORDING_MS);
}
