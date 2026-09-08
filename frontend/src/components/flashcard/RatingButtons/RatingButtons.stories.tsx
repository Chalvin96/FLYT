import type { Meta, StoryObj } from '@storybook/react';

import { RatingButtons } from './RatingButtons';

const meta = {
  title: 'Flashcard/RatingButtons',
  component: RatingButtons,
  tags: ['autodocs'],
  argTypes: {
    onRate: {
      action: 'onRate',
      description: 'Called when user rates the card',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether buttons are disabled',
    },
  },
} satisfies Meta<typeof RatingButtons>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onRate: (rating) => console.log('Rated:', rating),
  },
};
export const Disabled: Story = {
  args: {
    onRate: (rating) => console.log('Rated:', rating),
    disabled: true,
  },
};
