import type { Meta, StoryObj } from '@storybook/react';

import type { AudioAsset, ExampleBlock } from '@/types/lesson-contracts';

import { ExampleGroupView } from './ExampleGroupView';
import { fixtureAudio } from './fixtureAudio';

const audio = fixtureAudio('example-audio') satisfies AudioAsset;

const mixedBlocks: ExampleBlock[] = [
  {
    kind: 'example',
    id: 'incorrect-example',
    no: [{ kind: 'text', value: 'Jeg har sett filmen i går.' }],
    en: [
      {
        kind: 'text',
        value: 'Intended meaning: I watched the film yesterday.',
      },
    ],
    teaching_role: 'incorrect',
    audio_id: audio.id,
  },
  {
    kind: 'example',
    id: 'caution-example',
    no: [{ kind: 'text', value: 'Jeg tenker det går fint.' }],
    en: [
      {
        kind: 'text',
        value: 'Understandable, but less natural in this particular context.',
      },
    ],
    teaching_role: 'caution',
    audio_id: audio.id,
  },
  {
    kind: 'example',
    id: 'model-example',
    no: [{ kind: 'text', value: 'Jeg så filmen i går.' }],
    en: [{ kind: 'text', value: 'I watched the film yesterday.' }],
    audio_id: audio.id,
  },
];

const meta = {
  title: 'Features/Portable/ExampleGroupView',
  component: ExampleGroupView,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-2xl p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    blocks: mixedBlocks,
    audioById: { [audio.id]: audio },
  },
} satisfies Meta<typeof ExampleGroupView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MixedRoles: Story = {};

export const MixedRolesMobile: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const LongContentMobile: Story = {
  args: {
    blocks: [
      {
        kind: 'example',
        id: 'long-caution-example',
        no: [
          {
            kind: 'text',
            value:
              'Flyplassterminalbygningen kan beskrives på denne måten, men formuleringen krever litt omtanke.',
          },
        ],
        en: [
          {
            kind: 'text',
            value:
              'The airport terminal building can be described this way, but the phrasing needs some care in this context.',
          },
        ],
        teaching_role: 'caution',
        audio_id: audio.id,
      },
    ],
  },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const SingleIncorrect: Story = {
  args: { blocks: [mixedBlocks[0]] },
};
