import type { Meta, StoryObj } from '@storybook/react';

import { FlashCardLessonEnd } from './FlashCardLessonEnd';

const meta = {
  title: 'Flashcard/FlashCardLessonEnd',
  component: FlashCardLessonEnd,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
**FlashCardLessonEnd** is shown after all cards in a lesson have been reviewed.
It does not take a \`card\` prop — it is a purely presentational screen with no card data.

A **Finish** button appears when \`onFinished\` is provided. If omitted the button is hidden,
which is useful for preview or inline embedding contexts.
        `.trim(),
      },
    },
  },
  argTypes: {
    onFinished: {
      description:
        'Called when the user clicks **Finish**. If omitted, the button is not rendered.',
      table: { type: { summary: '() => void | undefined' } },
    },
    className: {
      description: 'Additional Tailwind classes applied to the outer wrapper.',
      table: { type: { summary: 'string | undefined' } },
    },
  },
} satisfies Meta<typeof FlashCardLessonEnd>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onFinished: () => console.log('finished'),
  },
};
export const WithoutButton: Story = {
  name: 'Edge — No Finish Button',
  parameters: {
    docs: {
      description: {
        story:
          'When `onFinished` is omitted the Finish button is not rendered.',
      },
    },
  },
  args: {},
};
