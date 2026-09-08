import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';

import { ErrorMessage } from './ErrorMessage';

const meta = {
  title: 'Common/ErrorMessage',
  component: ErrorMessage,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-content">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ErrorMessage>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    error: 'Could not save your changes.',
  },
};
export const WithActions: Story = {
  args: {
    error: new Error('Request timed out. Try again.'),
    onRetry: fn(),
    onDismiss: fn(),
  },
};
