import type { Meta, StoryObj } from '@storybook/react';

import { ErrorMessage } from './error-message';

const meta = {
  title: 'Design system/Feedback/Error message',
  component: ErrorMessage,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[min(640px,92vw)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ErrorMessage>;
export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <ErrorMessage error="The file could not be read." title="Upload failed" />
  ),
};

export const WithActions: Story = {
  render: () => (
    <ErrorMessage
      dismissLabel="Dismiss"
      error={new Error('Request timed out.')}
      onDismiss={() => {}}
      onRetry={() => {}}
      retryLabel="Try again"
      title="Could not save your changes"
    />
  ),
};
