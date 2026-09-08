import type { SpeechCheck } from '@/types/lesson-contracts';

import type { SpeechRecorderFn } from '../operationTypes';

export interface SpeechRecordingHandle {
  /** Stop the recorder and finalize with transcription. */
  stop: () => void;
  /** Detach handlers, stop the recorder, and release the stream silently. */
  detach: () => void;
}

export interface SpeechRecordingCallbacks {
  /** getUserMedia or capability check failed. */
  onDenied: () => void;
  /** Recorder failed or produced no usable audio. */
  onError: () => void;
  /** Recorder armed; provides the stop/detach handle. */
  onRecordingStarted: (handle: SpeechRecordingHandle) => void;
  /** A transcription request is ready to submit. */
  onTranscribe: (request: Promise<SpeechCheck>) => void;
}

export function isMediaRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined'
  );
}

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') {
    return undefined;
  }
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
}

/**
 * Module-level MediaRecorder wiring so the React hook only orchestrates
 * phase transitions. Requests the mic, wires recorder events, and reports
 * lifecycle changes through callbacks. `isCurrent` guards the async
 * getUserMedia resolution against a session that was skipped/unmounted.
 */
export function requestSpeechRecording({
  isCurrent,
  recordAndTranscribe,
  onDenied,
  onError,
  onRecordingStarted,
  onTranscribe,
}: SpeechRecordingCallbacks & {
  isCurrent: () => boolean;
  recordAndTranscribe: SpeechRecorderFn;
}): void {
  if (!isMediaRecordingSupported()) {
    onDenied();
    return;
  }

  void navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      if (!isCurrent()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const chunks: Blob[] = [];
      const supportedType = pickSupportedMimeType();
      let recorder: MediaRecorder;
      try {
        recorder = supportedType
          ? new MediaRecorder(stream, { mimeType: supportedType })
          : new MediaRecorder(stream);
      } catch {
        stream.getTracks().forEach((track) => track.stop());
        onError();
        return;
      }
      let stopRequested = false;
      let finalized = false;

      const release = () => {
        stream.getTracks().forEach((track) => track.stop());
        chunks.length = 0;
      };

      const finalizeRecording = (shouldTranscribe: boolean) => {
        if (finalized) return;
        finalized = true;
        const audio = new Blob(chunks, {
          type: recorder.mimeType || 'audio/webm',
        });
        release();
        if (!shouldTranscribe || !audio.size) {
          onError();
          return;
        }
        try {
          onTranscribe(recordAndTranscribe(audio));
        } catch {
          onError();
        }
      };

      const detach = () => {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.onerror = null;
        if (recorder.state !== 'inactive') recorder.stop();
        release();
      };

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => finalizeRecording(stopRequested);
      recorder.onerror = () => finalizeRecording(false);

      try {
        recorder.start();
      } catch {
        detach();
        onError();
        return;
      }

      onRecordingStarted({
        detach,
        stop: () => {
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
        },
      });
    })
    .catch(() => {
      if (isCurrent()) onDenied();
    });
}
