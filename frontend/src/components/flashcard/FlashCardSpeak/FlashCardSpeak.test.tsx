import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SpeakExercise, SpeechCheck } from '@/types/lesson-contracts';

import { K_OPERATION_REQUEST_TIMEOUT_MS } from '../operationRequest';
import { FlashCardSpeak } from './FlashCardSpeak';

const TARGET = 'Jeg snakker tydelig norsk.';

const exercise: SpeakExercise = {
  kind: 'exercise',
  id: 'speak-1',
  operation: 'speak',
  objective_id: 'obj-pronounce',
  prompt: [{ kind: 'text', value: 'Say this sentence aloud.' }],
  explanation: null,
  payload: { target: TARGET },
};

async function recordOnce(
  user: ReturnType<typeof userEvent.setup>,
  check: { transcript: string; passed: boolean },
) {
  transcribeImpl.mockResolvedValue(check);
  await user.click(screen.getByRole('button', { name: /tap to speak/i }));
  await user.click(screen.getByRole('button', { name: /stop recording/i }));
  await screen.findByRole('button', { name: /continue|check/i });
}

const transcribeImpl = vi.fn();

afterEach(() => {
  vi.useRealTimers();
});

describe('FlashCardSpeak', () => {
  it('test_speak_recording_given_supported_microphone_expect_blob_transcribed_and_tracks_stopped', async () => {
    const user = userEvent.setup();
    const onFinished = vi.fn();
    const recordAndTranscribe = vi.fn(async (audio: Blob) => {
      expect(audio).toBeInstanceOf(Blob);
      return { transcript: TARGET, passed: true };
    });
    const stopTrack = vi.fn();
    const stream = {
      getTracks: () => [{ stop: stopTrack }],
    } as unknown as MediaStream;
    const mediaDevicesDescriptor = Object.getOwnPropertyDescriptor(
      navigator,
      'mediaDevices',
    );

    class FakeMediaRecorder {
      static isTypeSupported() {
        return true;
      }

      state: RecordingState = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;

      start() {
        this.state = 'recording';
      }

      stop() {
        this.ondataavailable?.({ data: new Blob(['audio']) } as BlobEvent);
        this.state = 'inactive';
        this.onstop?.();
      }
    }

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => stream) },
    });
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);

    try {
      render(
        <FlashCardSpeak
          exercise={exercise}
          recordAndTranscribe={recordAndTranscribe}
          onFinished={onFinished}
        />,
      );

      await user.click(screen.getByRole('button', { name: /tap to speak/i }));
      await user.click(
        await screen.findByRole('button', { name: /stop recording/i }),
      );
      await user.click(await screen.findByRole('button', { name: /^check$/i }));
      await user.click(screen.getByRole('button', { name: /continue/i }));

      expect(recordAndTranscribe).toHaveBeenCalledOnce();
      expect(stopTrack).toHaveBeenCalledOnce();
      expect(onFinished).toHaveBeenCalledWith({
        kind: 'graded',
        correct: true,
        rating: 4,
      });
    } finally {
      vi.unstubAllGlobals();
      if (mediaDevicesDescriptor) {
        Object.defineProperty(
          navigator,
          'mediaDevices',
          mediaDevicesDescriptor,
        );
      }
    }
  });

  it('test_speak_recording_given_recorder_stops_externally_expect_recoverable_error', async () => {
    const user = userEvent.setup();
    const stopTrack = vi.fn();
    const stream = {
      getTracks: () => [{ stop: stopTrack }],
    } as unknown as MediaStream;
    const mediaDevicesDescriptor = Object.getOwnPropertyDescriptor(
      navigator,
      'mediaDevices',
    );
    class FakeMediaRecorder {
      static current: FakeMediaRecorder | null = null;

      static isTypeSupported() {
        return true;
      }

      state: RecordingState = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      onerror: (() => void) | null = null;

      constructor() {
        FakeMediaRecorder.current = this;
      }

      start() {
        this.state = 'recording';
      }

      stop() {
        this.state = 'inactive';
        this.onstop?.();
      }

      stopExternally() {
        this.state = 'inactive';
        this.onstop?.();
      }
    }

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => stream) },
    });
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);

    try {
      render(
        <FlashCardSpeak exercise={exercise} recordAndTranscribe={vi.fn()} />,
      );

      await user.click(screen.getByRole('button', { name: /tap to speak/i }));
      await screen.findByRole('button', { name: /stop recording/i });
      FakeMediaRecorder.current?.stopExternally();

      await waitFor(() => {
        expect(screen.getByTestId('flashcard-action-status')).toHaveTextContent(
          /couldn.t check that recording/i,
        );
        expect(
          screen.getByRole('button', { name: /try again/i }),
        ).toBeEnabled();
      });
      expect(stopTrack).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
      if (mediaDevicesDescriptor) {
        Object.defineProperty(
          navigator,
          'mediaDevices',
          mediaDevicesDescriptor,
        );
      }
    }
  });

  it('test_speak_result_given_first_attempt_passes_expect_graded_completion', async () => {
    const user = userEvent.setup();
    const onFinished = vi.fn();
    render(
      <FlashCardSpeak
        exercise={exercise}
        micGranted
        transcribe={transcribeImpl}
        onFinished={onFinished}
      />,
    );

    await recordOnce(user, { transcript: TARGET, passed: true });
    await user.click(screen.getByRole('button', { name: /^check$/i }));

    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledWith({
      kind: 'graded',
      correct: true,
      rating: 4,
    });
  });

  it('test_speak_result_given_pass_after_failed_attempt_expect_graded_completion', async () => {
    const user = userEvent.setup();
    const onFinished = vi.fn();
    render(
      <FlashCardSpeak
        exercise={exercise}
        micGranted
        transcribe={transcribeImpl}
        onFinished={onFinished}
      />,
    );

    await recordOnce(user, {
      transcript: 'Jeg snakker tydlig norsk',
      passed: false,
    });
    await user.click(screen.getByRole('button', { name: /record again/i }));
    await recordOnce(user, { transcript: TARGET, passed: true });
    await user.click(screen.getByRole('button', { name: /^check$/i }));

    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onFinished).toHaveBeenCalledWith({
      kind: 'graded',
      correct: true,
      rating: 4,
    });
  });

  it('test_speak_request_given_pending_transcription_expect_recoverable_error', async () => {
    vi.useFakeTimers();
    render(
      <FlashCardSpeak
        exercise={exercise}
        micGranted
        transcribe={() => new Promise<SpeechCheck>(() => undefined)}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /tap to speak/i }));
    fireEvent.click(screen.getByRole('button', { name: /stop recording/i }));

    await act(async () => {
      vi.advanceTimersByTime(K_OPERATION_REQUEST_TIMEOUT_MS);
      await Promise.resolve();
    });

    expect(screen.getByTestId('flashcard-action-status')).toHaveTextContent(
      /couldn.t check that recording/i,
    );
    expect(screen.getByRole('button', { name: /try again/i })).toBeEnabled();
  });

  it('test_speak_result_given_missing_target_words_expect_missing_transcript', () => {
    render(
      <FlashCardSpeak
        exercise={exercise}
        initialPhase="reviewed"
        initialTranscript="Jeg snakker norsk."
      />,
    );

    expect(screen.getByTestId('missing-transcript')).toHaveTextContent(
      'tydelig',
    );
  });
});
