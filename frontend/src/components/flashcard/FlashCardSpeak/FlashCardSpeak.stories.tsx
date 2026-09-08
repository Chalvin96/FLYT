import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import { fixtureAudio } from '@/components/portable/fixtureAudio';
import type { AudioAsset, SpeakExercise } from '@/types/lesson-contracts';

import { FlashCardSpeak } from './FlashCardSpeak';

const exercise: SpeakExercise = {
  kind: 'exercise',
  id: 'story-speak-01',
  operation: 'speak',
  objective_id: 'obj-pronounce',
  prompt: [{ kind: 'text', value: 'Say this sentence aloud.' }],
  explanation: null,
  payload: { target: 'Jeg snakker tydelig norsk.' },
};

const explainedExercise: SpeakExercise = {
  ...exercise,
  id: 'story-speak-01-explained',
  explanation: [
    {
      kind: 'text',
      value: 'Tydelig keeps its definite form; the adverb precedes the verb.',
    },
  ],
};

const modelAudio: AudioAsset = fixtureAudio('audio-speak-01');

const unresolvedAudio: AudioAsset = {
  id: 'audio-speak-01',
  url: '',
  path: 'audio/lessons/pron/00000000-0000-4000-8000-000000000001.wav',
  mime: 'audio/wav',
  duration_ms: 1600,
  sha256: 'stub',
  status: 'synthesized',
};

const delay = <T,>(value: T, ms = 1400): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const meta = {
  title: 'Flashcard/FlashCardSpeak',
  component: FlashCardSpeak,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div
        className="flex flex-col px-4 pt-4 pb-0"
        style={{ height: '100dvh' }}
      >
        <Story />
      </div>
    ),
  ],
  parameters: { layout: 'fullscreen' },
  args: {
    exercise,
    audio: modelAudio,
    className: 'flex-1',
    desktopExpanded: true,
    micGranted: true,
  },
  argTypes: { onFinished: { action: 'onFinished' } },
} satisfies Meta<typeof FlashCardSpeak>;
export default meta;

type Story = StoryObj<typeof meta>;

export const PermissionExplainer: Story = {
  args: { micGranted: false, initialPhase: 'permission' },
};

export const Ready: Story = {};

export const Recording: Story = { args: { initialPhase: 'recording' } };

export const Pass: Story = {
  args: {
    transcribe: () =>
      delay({ transcript: 'Jeg snakker tydelig norsk.', passed: true }),
  },
};

export const FailOneWord: Story = {
  args: {
    transcribe: () =>
      delay({ transcript: 'Jeg snakker tydlig norsk', passed: false }),
  },
};

export const FailBadly: Story = {
  args: {
    transcribe: () =>
      delay({ transcript: 'Jeg snakker norsk i dag', passed: false }),
  },
};

export const ReviewedMiss: Story = {
  args: {
    initialPhase: 'reviewed',
    initialTranscript: 'Jeg snakker tydlig norsk',
  },
};

export const ReviewedPass: Story = {
  args: {
    initialPhase: 'reviewed',
    initialTranscript: 'Jeg snakker tydelig norsk.',
  },
};

export const CheckedPassWithExplanation: Story = {
  args: {
    exercise: explainedExercise,
    initialPhase: 'reviewed',
    initialTranscript: 'Jeg snakker tydelig norsk.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByText(/tydelig keeps its definite form/i),
    ).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: /check/i }));
    await expect(canvas.getByText(/^Correct$/)).toBeInTheDocument();
    await expect(
      canvas.getByText(/tydelig keeps its definite form/i),
    ).toBeInTheDocument();
  },
};

export const MicDenied: Story = { args: { initialPhase: 'denied' } };

export const SttError: Story = {
  args: {
    initialPhase: 'error',
    transcribe: () => Promise.reject(new Error('stt unavailable')),
  },
};

export const PlaceholderAudio: Story = { args: { audio: unresolvedAudio } };

export const NoModelAudio: Story = { args: { audio: null } };
