import type { Meta, StoryObj } from '@storybook/react';

import type {
  AudioAsset,
  ReadingBlock as ReadingBlockData,
} from '@/types/lesson-contracts';

import { fixtureAudio } from './fixtureAudio';
import { ReadingBlock } from './ReadingBlock';

const block: ReadingBlockData = {
  kind: 'reading',
  id: 'reading-001',
  spans: [{ kind: 'text', value: 'Hvor er holdeplassen?' }],
  translation: 'Where is the bus stop?',
  audio_id: 'audio-reading-001',
};

const meta = {
  title: 'Portable/ReadingBlock',
  component: ReadingBlock,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-2xl p-4">
        <Story />
      </div>
    ),
  ],
  args: { block, audio: fixtureAudio('audio-reading-001') },
} satisfies Meta<typeof ReadingBlock>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Playable enriched audio: the control plays the fixture tone. */
export const Default: Story = {};

/**
 * The asset is listed in the packet but has no enriched URL (for example,
 * media not copied): the control stays inert, never a dead press.
 */
export const UnresolvedAudio: Story = {
  args: {
    audio: {
      id: 'audio-reading-001',
      url: '',
      path: 'audio/lessons/directions/00000000-0000-4000-8000-000000000001.wav',
      mime: 'audio/wav',
      duration_ms: 1250,
      sha256: 'stub',
      status: 'synthesized',
    } satisfies AudioAsset,
  },
};

/** Contract §8: an audio-unavailable path must still show the Norwegian. */
export const NoAudio: Story = { args: { audio: null } };

export const LongLine: Story = {
  args: {
    block: {
      ...block,
      spans: [
        {
          kind: 'text',
          value:
            'Unnskyld, kan du fortelle meg hvor den nærmeste holdeplassen for bussen til sentrum ligger?',
        },
      ],
      translation:
        'Excuse me, could you tell me where the nearest stop for the bus to the city centre is?',
    },
  },
};
