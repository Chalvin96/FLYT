import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import type { Exercise } from '@/types/lesson-contracts';

import { FlashCardCategorize } from './FlashCardCategorize';

const categorizeExercise: Extract<Exercise, { operation: 'categorize' }> = {
  kind: 'exercise',
  objective_id: 'obj-1',
  id: 'story-categorize-gender',
  operation: 'categorize',
  prompt: [{ kind: 'text', value: 'Sort each noun by grammatical gender.' }],
  explanation: [
    { kind: 'text', value: 'En words are common gender. Et words are neuter.' },
  ],
  payload: {
    buckets: [
      { bucket_id: 'common', label: 'Common gender' },
      { bucket_id: 'neuter', label: 'Neuter' },
    ],
    items: [
      { item_id: 'bok', text: 'en bok', bucket_id: 'common' },
      { item_id: 'hus', text: 'et hus', bucket_id: 'neuter' },
      { item_id: 'dag', text: 'en dag', bucket_id: 'common' },
    ],
  },
};

const meta = {
  title: 'Flashcard/FlashCardCategorize',
  component: FlashCardCategorize,
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
} satisfies Meta<typeof FlashCardCategorize>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { exercise: categorizeExercise, desktopExpanded: true },
};

/**
 * Play function: arms each item (tap) then taps the correct bucket to
 * place it, clicks Check, and verifies the "Correct" banner appears.
 * Demonstrates the tap-to-place interaction alongside drag.
 */
export const ResultCorrect: Story = {
  args: { exercise: categorizeExercise, desktopExpanded: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const common = canvas
      .getAllByTestId('drop-zone')
      .find((el) => el.getAttribute('data-dropzone-id') === 'common')!;
    const neuter = canvas
      .getAllByTestId('drop-zone')
      .find((el) => el.getAttribute('data-dropzone-id') === 'neuter')!;

    // Place en bok → common
    await userEvent.click(canvas.getByText('en bok'));
    await userEvent.click(common);
    // Place et hus → neuter
    await userEvent.click(canvas.getByText('et hus'));
    await userEvent.click(neuter);
    // Place en dag → common
    await userEvent.click(canvas.getByText('en dag'));
    await userEvent.click(common);

    await userEvent.click(canvas.getByRole('button', { name: /check/i }));
    await expect(canvas.getByText(/correct/i)).toBeInTheDocument();
    await expect(
      canvas.getByText(/en words are common gender/i),
    ).toBeInTheDocument();
  },
};
