import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import type { Exercise } from '@/types/lesson-contracts';

import { FlashCardJudge } from './FlashCardJudge';

const judgeExercise: Extract<Exercise, { operation: 'judge' }> = {
  kind: 'exercise',
  objective_id: 'obj-1',
  id: 'story-judge-subordinate-word-order',
  operation: 'judge',
  prompt: [{ kind: 'text', value: 'Decide whether the sentence is correct.' }],
  explanation: [
    { kind: 'text', value: 'After fordi, ikke comes before the finite verb.' },
  ],
  payload: {
    sentence: [
      { kind: 'text', value: 'Jeg blir hjemme fordi jeg kan ikke komme.' },
    ],
    is_correct: false,
    feedback: 'Jeg blir hjemme fordi jeg ikke kan komme.',
  },
};

const meta = {
  title: 'Flashcard/FlashCardJudge',
  component: FlashCardJudge,
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
} satisfies Meta<typeof FlashCardJudge>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { exercise: judgeExercise, desktopExpanded: true },
};

/**
 * Play function: taps "Incorrect" (the correct answer for this fixture),
 * clicks Check, and verifies the "Correct" banner appears.
 */
export const ResultCorrect: Story = {
  args: { exercise: judgeExercise, desktopExpanded: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole('radio', { name: /it has an error/i }),
    );
    await userEvent.click(canvas.getByRole('button', { name: /check/i }));
    await expect(canvas.getByRole('status')).toHaveTextContent(/correct/i);
  },
};

/**
 * Wrong answer with authored feedback: the correction is shown once as the
 * authoritative feedback, and the generic explanation follows below it —
 * not as a duplicate of the correction.
 */
export const ResultWrongWithCorrection: Story = {
  args: { exercise: judgeExercise, desktopExpanded: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole('radio', { name: /the sentence is correct/i }),
    );
    await userEvent.click(canvas.getByRole('button', { name: /check/i }));

    await expect(canvas.getByText(/not quite/i)).toBeInTheDocument();
    const correction = canvas.getAllByText(
      /Jeg blir hjemme fordi jeg ikke kan komme\./i,
    );
    await expect(correction).toHaveLength(1);
    await expect(
      canvas.getByText(/ikke comes before the finite verb/i),
    ).toBeInTheDocument();
  },
};
