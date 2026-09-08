import { afterEach, describe, expect, it, vi } from 'vitest';

import { AudioPlaybackController } from './audio-playback';

class FakeAudio {
  static instances: FakeAudio[] = [];

  readonly src: string;
  readonly listeners = new Map<string, Set<() => void>>();
  readonly pause = vi.fn();
  readonly play = vi.fn(() => Promise.resolve());

  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }

  addEventListener(event: string, listener: () => void) {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(listener);
    this.listeners.set(event, listeners);
  }

  removeEventListener(event: string, listener: () => void) {
    this.listeners.get(event)?.delete(listener);
  }

  dispatch(event: string) {
    for (const listener of this.listeners.get(event) ?? []) listener();
  }
}

afterEach(() => {
  FakeAudio.instances = [];
  vi.unstubAllGlobals();
});

describe('AudioPlaybackController', () => {
  it('test_audio_playback_given_new_clip_expect_stops_previous_clip', () => {
    vi.stubGlobal('Audio', FakeAudio as unknown as typeof Audio);
    const controller = new AudioPlaybackController();

    controller.play('https://media.example.test/one.wav');
    controller.play('https://media.example.test/two.wav');

    expect(FakeAudio.instances[0].pause).toHaveBeenCalledOnce();
    expect(controller.isPlaying('https://media.example.test/one.wav')).toBe(
      false,
    );
    expect(controller.isPlaying('https://media.example.test/two.wav')).toBe(
      true,
    );
  });

  it('test_audio_playback_given_media_end_expect_clears_active_state', () => {
    vi.stubGlobal('Audio', FakeAudio as unknown as typeof Audio);
    const controller = new AudioPlaybackController();

    controller.play('https://media.example.test/one.wav');
    FakeAudio.instances[0].dispatch('ended');

    expect(controller.isPlaying('https://media.example.test/one.wav')).toBe(
      false,
    );
  });

  it('test_audio_playback_given_media_error_expect_clears_state_and_notifies_caller', () => {
    vi.stubGlobal('Audio', FakeAudio as unknown as typeof Audio);
    const controller = new AudioPlaybackController();
    const onError = vi.fn();

    controller.play('https://media.example.test/one.wav', { onError });
    FakeAudio.instances[0].dispatch('error');

    expect(controller.isPlaying('https://media.example.test/one.wav')).toBe(
      false,
    );
    expect(onError).toHaveBeenCalledOnce();
  });
});
