import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';

import type { AudioAsset, ReadingBlock } from '@/types/lesson-contracts';

import type { DialogueGroup } from './dialogueGrouping';
import { DialogueView } from './DialogueView';

class FakeAudio {
  static instances: FakeAudio[] = [];

  src: string;
  paused = true;
  listeners: Record<string, Array<() => void>> = {};
  play = vi.fn(() => {
    this.paused = false;
    return Promise.resolve();
  });
  pause = vi.fn(() => {
    this.paused = true;
  });

  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }

  addEventListener(event: string, listener: () => void) {
    this.listeners[event] = [...(this.listeners[event] ?? []), listener];
  }

  removeEventListener() {}

  dispatch(event: 'ended' | 'error') {
    for (const listener of this.listeners[event] ?? []) listener();
  }
}

function turn(
  id: string,
  speakerId: string,
  speakerName: string,
  turnIndex: number,
): ReadingBlock {
  return {
    kind: 'reading',
    id,
    spans: [{ kind: 'text', value: `${id} text` }],
    translation: `${id} translation`,
    dialogue_id: 'd1',
    speaker_id: speakerId,
    speaker_name: speakerName,
    turn_index: turnIndex,
    audio_id: `audio-${id}`,
  };
}

const turns = [
  turn('r1', 'anna', 'Anna', 1),
  turn('r2', 'bjorn', 'Bjørn', 2),
  turn('r3', 'anna', 'Anna', 3),
];

const group: DialogueGroup = { dialogueId: 'd1', turns };

function audioById(withPlayable: boolean): Record<string, AudioAsset> {
  return Object.fromEntries(
    turns.map((block, index) => [
      block.audio_id as string,
      {
        id: block.audio_id as string,
        url: withPlayable && index !== 1 ? `media://${block.audio_id}` : '',
        path: `audio/lessons/fixtures/${block.audio_id}.wav`,
        mime: 'audio/wav',
        duration_ms: 500,
        status: 'synthesized',
      } satisfies AudioAsset,
    ]),
  );
}

function audioByIdWithSharedSource(): Record<string, AudioAsset> {
  return Object.fromEntries(
    turns.map((block) => [
      block.audio_id as string,
      {
        id: block.audio_id as string,
        url: 'media://shared-dialogue',
        path: `audio/lessons/fixtures/${block.audio_id}.wav`,
        mime: 'audio/wav',
        duration_ms: 500,
        status: 'synthesized',
      } satisfies AudioAsset,
    ]),
  );
}

beforeEach(() => {
  FakeAudio.instances = [];
  vi.stubGlobal('Audio', FakeAudio as unknown as typeof Audio);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function playAll() {
  await userEvent.click(screen.getByRole('button', { name: /play all/i }));
}

describe('DialogueView', () => {
  it('test_dialogue_play_all_given_playable_turns_expect_sequential_audio_in_order', async () => {
    render(<DialogueView group={group} audioById={audioById(true)} />);

    await playAll();

    // Turn 2 has no playable asset: it is skipped, never faked.
    expect(FakeAudio.instances.map((audio) => audio.src)).toEqual([
      'media://audio-r1',
    ]);

    await act(async () => {
      FakeAudio.instances[0].dispatch('ended');
    });
    expect(FakeAudio.instances.map((audio) => audio.src)).toEqual([
      'media://audio-r1',
      'media://audio-r3',
    ]);

    await act(async () => {
      FakeAudio.instances[1].dispatch('ended');
    });
    expect(FakeAudio.instances).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: /play all/i }),
    ).toBeInTheDocument();
  });

  it('test_dialogue_line_audio_given_shared_source_expect_only_clicked_line_playing', async () => {
    render(
      <DialogueView group={group} audioById={audioByIdWithSharedSource()} />,
    );

    const lineButtons = screen.getAllByRole('button', {
      name: /Play .* line/i,
    });
    await userEvent.click(lineButtons[0]);

    expect(lineButtons[0]).toHaveAttribute('data-state', 'playing');
    expect(lineButtons[1]).toHaveAttribute('data-state', 'idle');
    expect(lineButtons[2]).toHaveAttribute('data-state', 'idle');
    expect(lineButtons[0]).toHaveAccessibleName('Stop audio');
    expect(lineButtons[1]).toHaveAccessibleName("Play Bjørn's line");
    expect(lineButtons[2]).toHaveAccessibleName("Play Anna's line");
  });

  it('test_dialogue_play_all_given_playing_turn_expect_active_highlight', async () => {
    render(<DialogueView group={group} audioById={audioById(true)} />);

    await playAll();

    expect(screen.getByTestId('dialogue-turn-r1')).toHaveClass(
      'border-primary-30',
    );
    expect(screen.getByTestId('dialogue-turn-r3')).not.toHaveClass(
      'border-primary-30',
    );
  });

  it('test_dialogue_stop_given_playing_expect_pause_and_no_further_turns', async () => {
    render(<DialogueView group={group} audioById={audioById(true)} />);

    await playAll();
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));

    expect(FakeAudio.instances[0].pause).toHaveBeenCalled();
    expect(screen.getByTestId('dialogue-turn-r1')).not.toHaveClass(
      'border-primary-30',
    );

    FakeAudio.instances[0].dispatch('ended');
    expect(FakeAudio.instances).toHaveLength(1);
  });

  it('test_dialogue_error_given_media_error_during_run_expect_run_stops', async () => {
    render(<DialogueView group={group} audioById={audioById(true)} />);

    await playAll();
    await act(async () => {
      FakeAudio.instances[0].dispatch('error');
    });

    expect(
      screen.getByRole('button', { name: /play all/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('dialogue-turn-r1')).not.toHaveClass(
      'border-primary-30',
    );
    await act(async () => {
      FakeAudio.instances[0].dispatch('ended');
    });
    expect(FakeAudio.instances).toHaveLength(1);
  });

  it('test_dialogue_unmount_given_playing_expect_media_paused', async () => {
    const { unmount } = render(
      <DialogueView group={group} audioById={audioById(true)} />,
    );

    await playAll();
    unmount();

    expect(FakeAudio.instances[0].pause).toHaveBeenCalled();
  });

  it('test_dialogue_play_all_given_stale_callback_from_previous_run_expect_ignored', async () => {
    render(<DialogueView group={group} audioById={audioById(true)} />);

    await playAll();
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    await playAll();

    const stale = FakeAudio.instances[0];
    stale.dispatch('ended');

    expect(FakeAudio.instances.map((audio) => audio.src)).toEqual([
      'media://audio-r1',
      'media://audio-r1',
    ]);
  });

  it('test_dialogue_play_all_given_no_playable_turns_expect_button_disabled', () => {
    render(<DialogueView group={group} audioById={{}} />);

    expect(screen.getByRole('button', { name: /play all/i })).toBeDisabled();
    expect(screen.getByText('r1 text')).toBeInTheDocument();
    expect(screen.getAllByText('Anna')).not.toHaveLength(0);
  });
});
