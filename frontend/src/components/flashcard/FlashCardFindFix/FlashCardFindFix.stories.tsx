import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import type { Exercise } from '@/types/lesson-contracts';

import { FlashCardFindFix } from './FlashCardFindFix';

const findFixExercise: Extract<Exercise, { operation: 'find_fix' }> = {
  kind: 'exercise',
  objective_id: 'obj-1',
  id: 'story-find-fix-definite-noun',
  operation: 'find_fix',
  prompt: [{ kind: 'text', value: 'Find the word that needs fixing.' }],
  explanation: [
    { kind: 'text', value: 'The definite form of en bil is bilen.' },
  ],
  payload: {
    tokens: [
      { token_id: 'jeg', text: 'Jeg' },
      { token_id: 'ser', text: 'ser' },
      { token_id: 'bil', text: 'bil' },
      { token_id: 'utenfor', text: 'utenfor' },
    ],
    error_token_id: 'bil',
    feedback: 'Jeg ser bilen utenfor.',
  },
};

const meta = {
  title: 'Flashcard/FlashCardFindFix',
  component: FlashCardFindFix,
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
} satisfies Meta<typeof FlashCardFindFix>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { exercise: findFixExercise, desktopExpanded: true },
};

/**
 * Play function: taps "bil" (the error token), clicks Check, and verifies
 * the "Correct" banner appears.
 */
export const ResultCorrect: Story = {
  args: { exercise: findFixExercise, desktopExpanded: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByText('bil'));
    await userEvent.click(canvas.getByRole('button', { name: /check/i }));
    await expect(canvas.getByRole('status')).toHaveTextContent(/correct/i);
    await expect(
      canvas.getByText(/the definite form of en bil is bilen/i),
    ).toBeInTheDocument();
  },
};
