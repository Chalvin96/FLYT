import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';

import { fixtureAudio } from '@/components/portable/fixtureAudio';
import type { AudioAsset, SectionPacket } from '@/types/lesson-contracts';

import { FlashCardInfo } from './FlashCardInfo';

const section: SectionPacket = {
  kind: 'section',
  id: 'section-because-model',
  role: 'model',
  title: 'Because-clauses in a sentence',
  objective_ids: ['objective-because-clauses'],
  blocks: [
    {
      kind: 'paragraph',
      id: 'paragraph-1',
      spans: [
        {
          kind: 'text',
          value:
            'Use fordi when you want to give a reason. The verb stays in second position in the main clause.',
        },
      ],
    },
    {
      kind: 'reading',
      id: 'reading-1',
      spans: [
        { kind: 'text', value: 'Jeg blir hjemme fordi jeg ikke kan komme.' },
      ],
      translation: 'I am staying home because I cannot come.',
      audio_id: 'audio-reading-1',
      dialogue_id: null,
    },
    {
      kind: 'example',
      id: 'example-standalone',
      no: [{ kind: 'text', value: 'Hun tar bussen fordi det regner.' }],
      en: [{ kind: 'text', value: 'She takes the bus because it is raining.' }],
      audio_id: 'audio-example-standalone',
    },
    {
      kind: 'example',
      id: 'example-item-audio',
      no: [{ kind: 'text', value: 'Jeg blir hjemme fordi jeg er syk.' }],
      en: [{ kind: 'text', value: 'I am staying home because I am sick.' }],
      audio_id: 'audio-example-item',
    },
    {
      kind: 'example',
      id: 'example-item-text-only',
      no: [{ kind: 'text', value: 'Vi går fordi været er fint.' }],
      en: [{ kind: 'text', value: 'We walk because the weather is nice.' }],
      audio_id: null,
    },
  ],
};

const audioById: Record<string, AudioAsset> = {
  'audio-reading-1': fixtureAudio('audio-reading-1'),
  'audio-example-standalone': fixtureAudio('audio-example-standalone'),
  'audio-example-item': fixtureAudio('audio-example-item'),
};

const longExamplesSection: SectionPacket = {
  ...section,
  id: 'section-long-examples',
  title: 'Ordering at a café',
  blocks: [
    {
      kind: 'paragraph',
      id: 'paragraph-long-examples',
      spans: [
        {
          kind: 'text',
          value:
            'Compare the sentence lengths while keeping the examples easy to scan.',
        },
      ],
    },
    {
      kind: 'example',
      id: 'example-short',
      no: [{ kind: 'text', value: 'Jeg vil gjerne ha kaffe.' }],
      en: [{ kind: 'text', value: 'I would like coffee.' }],
      audio_id: null,
    },
    {
      kind: 'example',
      id: 'example-medium',
      no: [{ kind: 'text', value: 'Kan jeg få et rundstykke med ost?' }],
      en: [{ kind: 'text', value: 'Can I have a bread roll with cheese?' }],
      audio_id: null,
    },
    {
      kind: 'example',
      id: 'example-long',
      no: [
        {
          kind: 'text',
          value:
            'Jeg vil gjerne ha en stor kaffe med melk og et rundstykke med ost, takk.',
        },
      ],
      en: [
        {
          kind: 'text',
          value:
            'I would like a large coffee with milk and a bread roll with cheese, please.',
        },
      ],
      audio_id: null,
    },
  ],
};

/**
 * Assets referenced by the packet but unresolved to enriched URLs (media not
 * copied): every line keeps its text and no control is offered.
 */
const unresolvedAudioById: Record<string, AudioAsset> = {
  'audio-reading-1': {
    id: 'audio-reading-1',
    url: '',
    path: 'audio/lessons/because/00000000-0000-4000-8000-000000000001.wav',
    mime: 'audio/wav',
    duration_ms: 1700,
    status: 'synthesized',
  },
  'audio-example-standalone': {
    id: 'audio-example-standalone',
    url: '',
    path: 'audio/lessons/because/00000000-0000-4000-8000-000000000002.wav',
    mime: 'audio/wav',
    status: 'synthesized',
  },
  'audio-example-item': {
    id: 'audio-example-item',
    url: '',
    path: 'audio/lessons/because/00000000-0000-4000-8000-000000000003.wav',
    mime: 'audio/wav',
    status: 'synthesized',
  },
};

const meta = {
  title: 'Lesson/FlashCardInfo',
  component: FlashCardInfo,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="mx-auto flex min-h-screen max-w-3xl items-start bg-background p-4 sm:p-8">
        <Story />
      </div>
    ),
  ],
  args: {
    section,
    audioById,
    onContinue: fn(),
  },
} satisfies Meta<typeof FlashCardInfo>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Consecutive example blocks are grouped into one surface. Playable examples
 * show a control beside the Norwegian line; text-only examples stay clean.
 */
export const LessonContent: Story = {};

export const LessonContentMobile: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const LongExamples: Story = {
  args: { section: longExamplesSection, audioById: {} },
};

/**
 * No enriched URLs: the reading line keeps its (unavailable) control, and
 * example surfaces fall back to text-only with no play affordance.
 */
export const UnresolvedAudio: Story = {
  args: { audioById: unresolvedAudioById },
};

export const NoAudio: Story = {
  args: { audioById: {} },
};
