import type { Meta, StoryObj } from '@storybook/react';

import type { AudioAsset, ReadingBlock } from '@/types/lesson-contracts';

import { groupReadings } from './dialogueGrouping';
import { DialogueView } from './DialogueView';
import { fixtureAudio } from './fixtureAudio';

function turn(
  id: string,
  speakerId: string,
  speakerName: string,
  turnIndex: number,
  no: string,
  en: string,
): ReadingBlock {
  return {
    kind: 'reading',
    id,
    spans: [{ kind: 'text', value: no }],
    translation: en,
    dialogue_id: 'directions-1',
    speaker_id: speakerId,
    speaker_name: speakerName,
    turn_index: turnIndex,
    audio_id: `audio-${id}`,
  };
}

const twoSpeaker: ReadingBlock[] = [
  turn(
    'r1',
    'anna',
    'Anna',
    1,
    'Unnskyld, hvor er holdeplassen?',
    'Excuse me, where is the bus stop?',
  ),
  turn(
    'r2',
    'bjorn',
    'Bjørn',
    2,
    'Den ligger rett rundt hjørnet.',
    "It's just around the corner.",
  ),
  turn(
    'r3',
    'anna',
    'Anna',
    3,
    'Tar det lang tid å gå dit?',
    'Does it take long to walk there?',
  ),
  turn(
    'r4',
    'bjorn',
    'Bjørn',
    4,
    'Nei, bare to minutter.',
    'No, only two minutes.',
  ),
  turn(
    'r5',
    'anna',
    'Anna',
    5,
    'Tusen takk for hjelpen!',
    'Thank you so much for the help!',
  ),
];

const threeSpeaker: ReadingBlock[] = [
  ...twoSpeaker.slice(0, 3),
  turn(
    'r6',
    'kari',
    'Kari',
    4,
    'Jeg skal også dit. Bli med meg.',
    "I'm going there too. Come with me.",
  ),
];

const playableAudioById: Record<string, AudioAsset> = Object.fromEntries(
  [...twoSpeaker, ...threeSpeaker].map((block) => [
    block.audio_id as string,
    fixtureAudio(block.audio_id as string),
  ]),
);

const packetPathAudioById: Record<string, AudioAsset> = Object.fromEntries(
  [...twoSpeaker, ...threeSpeaker].map((block) => [
    block.audio_id as string,
    {
      id: block.audio_id as string,
      url: '',
      path: 'audio/lessons/directions/00000000-0000-4000-8000-000000000001.wav',
      mime: 'audio/wav',
      duration_ms: 1500,
      sha256: 'stub',
      status: 'synthesized',
    } satisfies AudioAsset,
  ]),
);

const meta = {
  title: 'Portable/DialogueView',
  component: DialogueView,
  tags: ['autodocs'],
  parameters: {
    viewport: {
      // Default desktop; mobile is one story away for every state below.
      defaultViewport: 'desktop',
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-2xl p-4">
        <Story />
      </div>
    ),
  ],
  args: { audioById: playableAudioById, title: 'Asking for directions' },
} satisfies Meta<typeof DialogueView>;
export default meta;

type Story = StoryObj<typeof meta>;

const groupOf = (blocks: ReadingBlock[]) => {
  const entry = groupReadings(blocks)[0];
  if (entry.kind !== 'dialogue') throw new Error('expected a dialogue group');
  return entry.group;
};

/** Two speakers alternate sides so the exchange reads as a conversation. */
export const TwoSpeakers: Story = { args: { group: groupOf(twoSpeaker) } };

export const TwoSpeakersMobile: Story = {
  ...TwoSpeakers,
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

/** Three or more stay in one column — alternating sides stops being legible. */
export const ThreeSpeakers: Story = { args: { group: groupOf(threeSpeaker) } };

/**
 * Play-all runs the real audio: each turn starts when the previous clip
 * ends, the active turn is highlighted, and Stop cancels the queue.
 */
export const PlayableAudio: Story = {
  args: { group: groupOf(twoSpeaker) },
};

/**
 * No turn resolves to playable media: the dialogue stays readable and Play
 * all is disabled rather than pretending to play.
 */
export const NoAudio: Story = {
  args: { group: groupOf(twoSpeaker), audioById: {} },
};

/** Every per-turn control is inert; Play all is not actionable. */
export const NoAudioMobile: Story = {
  ...NoAudio,
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

/**
 * Assets exist in the packet but the enriched URLs are missing (for example,
 * media not yet copied): per-turn controls stay disabled and Play all cannot
 * start, with no misleading enabled state.
 */
export const UnresolvedAudio: Story = {
  args: { group: groupOf(twoSpeaker), audioById: packetPathAudioById },
};

/**
 * A media error mid-dialogue stops the run: the active highlight clears and
 * no later turn starts automatically. Manually: play, then Stop, or let a
 * clip fail to load.
 */
export const StoppedMidDialogue: Story = {
  args: { group: groupOf(twoSpeaker.slice(0, 3)) },
};

/** Turns arrive out of order on the wire; turn_index is the ordering authority. */
export const ShuffledOnTheWire: Story = {
  args: { group: groupOf([...twoSpeaker].reverse()) },
};
