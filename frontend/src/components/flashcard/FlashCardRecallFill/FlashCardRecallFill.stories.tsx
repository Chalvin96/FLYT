import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import type { Exercise } from '@/types/lesson-contracts';

import { FlashCardRecallFill } from './FlashCardRecallFill';

const recallFillExercise: Extract<Exercise, { operation: 'recall_fill' }> = {
  kind: 'exercise',
  objective_id: 'obj-1',
  id: 'story-recall-fill-present-tense',
  operation: 'recall_fill',
  prompt: [{ kind: 'text', value: 'Choose the correct form.' }],
  explanation: [
    {
      kind: 'text',
      value: 'Hus is neuter, so the adjective takes the -t ending: stort.',
    },
  ],
  payload: {
    segments: [
      { kind: 'span', spans: [{ kind: 'text', value: 'Huset er ' }] },
      {
        kind: 'blank',
        blank_id: 'adj',
        options: ['stor', 'stort'],
        answer_index: 1,
      },
      { kind: 'span', spans: [{ kind: 'text', value: '.' }] },
    ],
  },
};

const meta = {
  title: 'Flashcard/FlashCardRecallFill',
  component: FlashCardRecallFill,
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
} satisfies Meta<typeof FlashCardRecallFill>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { exercise: recallFillExercise, desktopExpanded: true },
};

/**
 * Play function: taps the correct form ("stort"), which fills the slot live,
 * clicks Check, and verifies the "Correct" banner appears.
 */
export const ResultCorrect: Story = {
  args: { exercise: recallFillExercise, desktopExpanded: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('radio', { name: 'stort' }));
    const slot = canvas
      .getAllByTestId('blank-fill')
      .find((el) => el.getAttribute('data-blank-id') === 'adj')!;
    await expect(slot).toHaveTextContent('stort');

    await userEvent.click(canvas.getByRole('button', { name: /check/i }));
    await expect(canvas.getByRole('status')).toHaveTextContent(/correct/i);
  },
};

/**
 * Play function: taps the wrong form ("stor"), clicks Check, and verifies
 * the "Not quite" banner + wrong slot state appear. The authored
 * explanation follows the wrong-check result.
 */
export const ResultWrong: Story = {
  args: { exercise: recallFillExercise, desktopExpanded: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('radio', { name: 'stor' }));
    const slot = canvas
      .getAllByTestId('blank-fill')
      .find((el) => el.getAttribute('data-blank-id') === 'adj')!;
    await expect(slot).toHaveTextContent('stor');

    await expect(
      canvas.queryByText(/takes the -t ending/i),
    ).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: /check/i }));
    await expect(canvas.getByText(/not quite/i)).toBeInTheDocument();
    await expect(slot).toHaveAttribute('data-state', 'wrong');
    await expect(canvas.getByText(/takes the -t ending/i)).toBeInTheDocument();
  },
};
