import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import type { Exercise } from '@/types/lesson-contracts';

import { FlashCardMatch } from './FlashCardMatch';

const matchPairsExercise: Extract<Exercise, { operation: 'match_pairs' }> = {
  kind: 'exercise',
  objective_id: 'obj-1',
  id: 'story-match-pairs-basic-verbs',
  operation: 'match_pairs',
  prompt: [
    {
      kind: 'text',
      value: 'Match each Norwegian phrase with the English meaning.',
    },
  ],
  explanation: [
    { kind: 'text', value: 'These are common present-tense verb phrases.' },
  ],
  payload: {
    left: [
      { left_id: 'jeg-leser', text: 'jeg leser' },
      { left_id: 'hun-skriver', text: 'hun skriver' },
      { left_id: 'vi-spiser', text: 'vi spiser' },
    ],
    right: [
      { right_id: 'we-eat', text: 'we eat' },
      { right_id: 'i-read', text: 'I read' },
      { right_id: 'she-writes', text: 'she writes' },
    ],
    pairs: [
      { left_id: 'jeg-leser', right_id: 'i-read' },
      { left_id: 'hun-skriver', right_id: 'she-writes' },
      { left_id: 'vi-spiser', right_id: 'we-eat' },
    ],
  },
};

const meta = {
  title: 'Flashcard/FlashCardMatch',
  component: FlashCardMatch,
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
  args: { className: 'flex-1', desktopExpanded: true },
  argTypes: {
    exercise: { control: 'object' },
    onFinished: { action: 'onFinished' },
  },
} satisfies Meta<typeof FlashCardMatch>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { exercise: matchPairsExercise, desktopExpanded: true },
};

export const ResultCorrect: Story = {
  args: { exercise: matchPairsExercise, desktopExpanded: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Tap each Norwegian item, then its English match — pairs lock in place.
    const pairs: [RegExp, RegExp][] = [
      [/^jeg leser$/i, /^I read$/i],
      [/^hun skriver$/i, /^she writes$/i],
      [/^vi spiser$/i, /^we eat$/i],
    ];
    for (const [left, right] of pairs) {
      await userEvent.click(canvas.getByRole('button', { name: left }));
      await userEvent.click(canvas.getByRole('button', { name: right }));
    }

    // All matched → completion banner shows.
    await expect(canvas.getByText(/^correct$/i)).toBeInTheDocument();
    await expect(
      canvas.getByText(/common present-tense verb phrases/i),
    ).toBeInTheDocument();
  },
};
