import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AudioPlaybackController } from './audio-playback';
import { AudioPlayButton } from './audio-play-button';

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

  it('test_audio_playback_given_pending_play_rejects_after_pause_expect_recording_can_resume', async () => {
    vi.stubGlobal('Audio', FakeAudio as unknown as typeof Audio);
    const controller = new AudioPlaybackController();
    const src = 'https://media.example.test/one.wav';
    controller.play(src);
    const recording = FakeAudio.instances[0]!;
    let rejectPendingPlay: (reason: Error) => void = () => undefined;
    recording.play.mockImplementationOnce(
      () =>
        new Promise<void>((_, reject) => {
          rejectPendingPlay = reject;
        }),
    );

    controller.pause();
    controller.resume(src);
    controller.pause();
    rejectPendingPlay(new Error('Playback interrupted by pause'));
    await Promise.resolve();

    expect(controller.isPaused(src)).toBe(true);
    expect(controller.resume(src)).toBe(true);
    expect(FakeAudio.instances).toHaveLength(1);
    expect(recording.play).toHaveBeenCalledTimes(3);
    expect(controller.isPlaying(src)).toBe(true);
  });
});

describe('AudioPlayButton', () => {
  it.each(['inline', 'compact', 'compact-quiet'] as const)(
    'test_audio_play_button_given_hover_and_playback_expect_selected_text_on_selected_tint',
    async (presentation) => {
      vi.stubGlobal('Audio', FakeAudio);
      const user = userEvent.setup();
      render(
        createElement(AudioPlayButton, {
          presentation,
          src: 'https://media.example.test/one.wav',
        }),
      );

      const button = screen.getByRole('button', { name: 'Play audio' });
      const indicator =
        presentation === 'inline' ? button : button.firstElementChild;
      expect(indicator).toHaveClass(
        presentation === 'inline'
          ? 'hover:text-selected'
          : 'group-hover:text-selected',
      );

      await user.click(button);

      expect(button).toHaveAttribute('data-state', 'playing');
      expect(indicator).toHaveClass('bg-selected', 'text-selected');
      expect(indicator).not.toHaveClass('text-brand');

      await user.click(button);

      expect(button).toHaveAttribute('data-state', 'idle');
    },
  );
});
