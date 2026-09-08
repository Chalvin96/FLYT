import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import type { Exercise } from '@/types/lesson-contracts';

import { FlashCardChoose } from './FlashCardChoose';

const chooseExercise: Extract<Exercise, { operation: 'choose' }> = {
  kind: 'exercise',
  objective_id: 'obj-1',
  id: 'story-choose-adjective',
  operation: 'choose',
  prompt: [{ kind: 'text', value: 'Choose the adjective form that fits.' }],
  explanation: [
    {
      kind: 'text',
      value: 'Bok is common gender, so the basic adjective form is god.',
    },
  ],
  payload: {
    stem: [{ kind: 'text', value: 'Jeg leser en ___ bok.' }],
    answer_id: 'god',
    options: [
      {
        option_id: 'god',
        text: 'god',
        why: 'Correct for common-gender singular nouns.',
      },
      {
        option_id: 'godt',
        text: 'godt',
        why: 'Used with neuter singular nouns.',
      },
      {
        option_id: 'gode',
        text: 'gode',
        why: 'Used for plural and definite forms.',
      },
    ],
  },
};

const meta = {
  title: 'Flashcard/FlashCardChoose',
  component: FlashCardChoose,
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
  args: { className: 'flex-1' },
  argTypes: {
    exercise: { control: 'object' },
    onFinished: { action: 'onFinished' },
  },
} satisfies Meta<typeof FlashCardChoose>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    exercise: chooseExercise,
  },
};

/**
 * Play function: selects "god" (the correct option for this fixture),
 * clicks Check, and verifies the "Correct" banner appears.
 */
export const ResultCorrect: Story = {
  args: { exercise: chooseExercise },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('radio', { name: 'god' }));
    await userEvent.click(canvas.getByRole('button', { name: /check/i }));
    await expect(canvas.getByRole('status')).toHaveTextContent(/correct/i);
    await expect(
      canvas.getByText(/the basic adjective form is god/i),
    ).toBeInTheDocument();
  },
};

export const WithLongStem: Story = {
  args: {
    exercise: {
      ...chooseExercise,
      id: 'story-choose-subordinate-word-order',
      prompt: [
        {
          kind: 'text',
          value:
            'Choose the word order that belongs in the subordinate clause.',
        },
      ],
      explanation: [
        {
          kind: 'text',
          value:
            'After fordi, ikke usually comes before the finite verb in subordinate word order.',
        },
      ],
      payload: {
        stem: [
          {
            kind: 'text',
            value:
              'Jeg blir hjemme fordi ___ i dag. Look at the connector before you choose.',
          },
        ],
        answer_id: 'jeg-ikke-kan',
        options: [
          {
            option_id: 'jeg-ikke-kan',
            text: 'jeg ikke kan komme',
            why: 'Correct subordinate-clause word order.',
          },
          {
            option_id: 'jeg-kan-ikke',
            text: 'jeg kan ikke komme',
            why: 'Main-clause word order does not fit after fordi.',
          },
          {
            option_id: 'kan-jeg-ikke',
            text: 'kan jeg ikke komme',
            why: 'This has question-like inversion.',
          },
        ],
      },
    },
  },
};
