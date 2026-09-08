import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import type { Exercise } from '@/types/lesson-contracts';

import { FlashCardBuild } from './FlashCardBuild';

const buildExercise: Extract<Exercise, { operation: 'build' }> = {
  kind: 'exercise',
  objective_id: 'obj-1',
  id: 'story-build-negative-clause',
  operation: 'build',
  prompt: [
    { kind: 'text', value: 'Build the sentence with ikke in the right place.' },
  ],
  explanation: [
    {
      kind: 'text',
      value: 'In a simple main clause, ikke usually follows the verb.',
    },
  ],
  payload: {
    tokens: [
      { token_id: 'jeg', text: 'Jeg', fixed: true },
      { token_id: 'snakker', text: 'snakker', fixed: false },
      { token_id: 'ikke', text: 'ikke', fixed: false },
      { token_id: 'norsk', text: 'norsk', fixed: false },
      { token_id: 'enn', text: 'enn', fixed: false },
    ],
    answer_order: ['jeg', 'snakker', 'ikke', 'norsk', 'enn'],
  },
};

const meta = {
  title: 'Flashcard/FlashCardBuild',
  component: FlashCardBuild,
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
} satisfies Meta<typeof FlashCardBuild>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { exercise: buildExercise, desktopExpanded: true },
};

/**
 * Play function: taps each movable bank chip in the correct order,
 * clicks Check, and verifies the "Correct" banner appears.
 */
export const ResultCorrect: Story = {
  args: { exercise: buildExercise, desktopExpanded: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // movableAnswerOrder = snakker, ikke, norsk, enn.
    await userEvent.click(canvas.getByRole('button', { name: /add snakker/i }));
    await userEvent.click(canvas.getByRole('button', { name: /add ikke/i }));
    await userEvent.click(canvas.getByRole('button', { name: /add norsk/i }));
    await userEvent.click(canvas.getByRole('button', { name: /add enn/i }));

    await userEvent.click(canvas.getByRole('button', { name: /check/i }));
    await expect(canvas.getByText(/correct/i)).toBeInTheDocument();
    await expect(
      canvas.getByText(/ikke usually follows the verb/i),
    ).toBeInTheDocument();
  },
};

/**
 * Reveal is a terminal state too: after a wrong check the explanation is
 * still absent; revealing shows the answer and the explanation together.
 */
export const RevealedAfterWrongCheck: Story = {
  args: { exercise: buildExercise, desktopExpanded: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wrong order: ikke before snakker.
    await userEvent.click(canvas.getByRole('button', { name: /add ikke/i }));
    await userEvent.click(canvas.getByRole('button', { name: /add snakker/i }));
    await userEvent.click(canvas.getByRole('button', { name: /add norsk/i }));
    await userEvent.click(canvas.getByRole('button', { name: /add enn/i }));
    await userEvent.click(canvas.getByRole('button', { name: /check/i }));

    await expect(canvas.getAllByRole('alert')).toHaveLength(1);
    await expect(
      canvas.queryByText(/ikke usually follows the verb/i),
    ).not.toBeInTheDocument();

    await userEvent.click(
      canvas.getByRole('button', { name: /reveal answer/i }),
    );
    await expect(canvas.getByText(/here's the answer\./i)).toBeInTheDocument();
    await expect(
      canvas.getByText(/ikke usually follows the verb/i),
    ).toBeInTheDocument();
  },
};
