import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  requestSpeechRecording,
  type SpeechRecordingHandle,
} from './recorderSession';

const mediaDevicesDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  'mediaDevices',
);

afterEach(() => {
  vi.unstubAllGlobals();
  if (mediaDevicesDescriptor) {
    Object.defineProperty(navigator, 'mediaDevices', mediaDevicesDescriptor);
  }
});

function installMediaStream(stopTrack: () => void) {
  const stream = {
    getTracks: () => [{ stop: stopTrack }],
  } as unknown as MediaStream;
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => stream) },
  });
}

describe('requestSpeechRecording', () => {
  it('test_speech_recording_given_recorder_constructor_failure_expect_stream_released_and_error', async () => {
    const stopTrack = vi.fn();
    const onError = vi.fn();
    const onDenied = vi.fn();
    installMediaStream(stopTrack);

    class ThrowingMediaRecorder {
      static isTypeSupported() {
        return true;
      }

      constructor() {
        throw new Error('recorder construction failed');
      }
    }

    vi.stubGlobal('MediaRecorder', ThrowingMediaRecorder);
    requestSpeechRecording({
      isCurrent: () => true,
      onDenied,
      onError,
      onRecordingStarted: vi.fn(),
      onTranscribe: vi.fn(),
      recordAndTranscribe: vi.fn(),
    });

    await waitFor(() => expect(onError).toHaveBeenCalledOnce());
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(onDenied).not.toHaveBeenCalled();
  });

  it('test_speech_recording_given_synchronous_transcription_failure_expect_recoverable_error', async () => {
    const stopTrack = vi.fn();
    const onError = vi.fn();
    const onTranscribe = vi.fn();
    let recordingHandle: SpeechRecordingHandle | undefined;
    installMediaStream(stopTrack);

    class FakeMediaRecorder {
      static isTypeSupported() {
        return true;
      }

      state: RecordingState = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      onerror: (() => void) | null = null;

      start() {
        this.state = 'recording';
      }

      stop() {
        this.ondataavailable?.({ data: new Blob(['audio']) } as BlobEvent);
        this.state = 'inactive';
        this.onstop?.();
      }
    }

    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    requestSpeechRecording({
      isCurrent: () => true,
      onDenied: vi.fn(),
      onError,
      onRecordingStarted: (handle) => {
        recordingHandle = handle;
      },
      onTranscribe,
      recordAndTranscribe: () => {
        throw new Error('transcription failed synchronously');
      },
    });

    await waitFor(() => expect(recordingHandle).toBeDefined());
    recordingHandle?.stop();

    expect(onError).toHaveBeenCalledOnce();
    expect(onTranscribe).not.toHaveBeenCalled();
    expect(stopTrack).toHaveBeenCalledOnce();
  });
});
